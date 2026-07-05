# Inngest Orchestration Integration Tests — Implementation Plan

## Overview

Phase 2 of the test-plan rollout closes three production gaps (Risks 2, 3, 6) and proves
each one is protected through integration tests. All work lands in a single change:
targeted production code hardening followed by the integration test suite.

## Current State Analysis

The `extractRecipe` Inngest function (`src/inngest/functions.ts`) is a monolithic async
body — no `step.run()` steps, just sequential logic. This makes it untestable without an
Inngest dev server unless the pipeline body is extracted into an injectable helper.

Three concrete gaps found in the current code:

- **Risk 2 (output gate unwired):** `isExtractedRecipeUsable()` exists in
  `content-quality.ts:37` and is fully unit-tested (Phase 1). It is NOT called in
  `functions.ts`. The only post-LLM check is a title-only guard at line 191-193. A recipe
  with a valid title but empty ingredients/steps is persisted silently.

- **Risk 3 (send-failure blind spot):** In `actions.ts`, the `recipe_shares` row is
  correctly created before `inngest.send()` (line 38 before line 59). But if `inngest.send()`
  throws, the catch at line 70-72 only logs — the share stays `status: 'pending'` forever.
  `getFailedShares()` queries for `status = 'failed'` only, so the bell never surfaces it.

- **Risk 6 (SSRF in archiveImage):** `archiveImage()` in `recipe-image-archive.ts:19`
  calls `fetch(externalUrl, ...)` with no private-range blocklist. The `externalUrl` is
  derived from `scraped.metadata?.ogImage ?? extractFirstImage(html)` — fully
  content-controlled. Firecrawl does not mediate the image download.

## Desired End State

After this change:
- A known-junk fixture OR a title-only LLM response causes the Inngest function to throw
  before any Supabase insert/update is called — proven by integration test.
- A `inngest.send()` failure marks the share row as `failed` — proven by integration test.
- `archiveImage()` with a private/loopback/metadata URL returns `null` without making an
  outbound fetch — proven by integration test.
- `pnpm test` includes all three new test files and passes.

### Key Findings

- `functions.ts:129` — junk check (`looksUnextractable`) fires correctly before the OpenAI
  call. The output-side gap is after line 189 (`JSON.parse(content)`) and before line 244
  (the insert loop).
- `functions.ts:199-233` — force-refresh path skips the insert loop entirely; the output
  gate must also guard this path.
- `recipe-image-archive.ts:19` — the bare `fetch(externalUrl, ...)` is the SSRF surface.
  No other code path calls `archiveImage()` currently; guarding here protects all callers.
- `actions.ts:70-72` — the only change needed is in the catch block; the row already exists
  at this point, so the update is always safe.
- `env.ts` is imported at the top of `functions.ts`; to make the pipeline body importable
  in Vitest without triggering `server-only` / env-var checks, the extracted helper must
  live in a separate file that does NOT import `env.ts` or any `server-only` module.

## What We Are NOT Doing

- No Inngest dev server setup or Inngest-managed step tests.
- No real Supabase connection in integration tests — mocked Supabase fluent chain only.
- No E2E Playwright extension (that is Phase 3).
- No fix for the PINNED long-GT-passes-gate known miss documented in `content-quality.test.ts`.
- No multi-user / RLS tests (§7 negative space).

## Implementation Approach

Three phases: (1) production code hardening, (2) integration tests, (3) cookbook update.
Phases 1 and 2 are sequenced — tests depend on the extracted helper. Phase 3 is a doc
update after tests are green.

---

## Phase 1: Production Code Hardening

### Overview

Three targeted production changes: extract the pipeline into a testable helper, wire the
output gate, fix the send-failure blind spot, and add the SSRF guard.

### Required Changes

#### 1.1 Extract pipeline into `src/inngest/run-extract-recipe.ts`

**File:** `src/inngest/run-extract-recipe.ts` (new file)

**Goal:** Move the entire async body of `extractRecipe` out of `functions.ts` into an
exported function that accepts injected dependencies. The Inngest wrapper in `functions.ts`
becomes a thin shell that instantiates the Supabase client and calls this helper.

**Contract:**

```ts
// Exported types (used by functions.ts and tests)
export interface ExtractRecipeEvent {
  shareId: number
  sharedUrl: string
  sharedTitle?: string
  sharedText?: string
  userId: string
  sourceType?: 'facebook_text' | 'web_blog' | 'youtube'
  force?: boolean
}

export interface RunExtractRecipeDeps {
  fetch: typeof globalThis.fetch
  supabase: import('@supabase/supabase-js').SupabaseClient
}

export async function runExtractRecipe(
  event: ExtractRecipeEvent,
  deps: RunExtractRecipeDeps,
): Promise<{ recipeId: number; title: string; category: string; status: string }>
```

This file imports ONLY from pure lib modules (`buildFirecrawlOptions`, `buildEmbedScanOptions`,
`slugify`, `archiveImage`, `youtubeIdFromUrl`, `findEmbeddedYoutubeId`, `isBlogspotUrl`,
`fetchBloggerPost`, `looksUnextractable`, `isExtractedRecipeUsable`, `RECIPE_CATEGORIES`).
It must NOT import `env.ts`, `server-only`, or `@/inngest/client`.

**Wire `isExtractedRecipeUsable`:** Immediately after `JSON.parse(content)`, add:
```ts
if (!isExtractedRecipeUsable(recipeJSON)) {
  throw new Error(
    'Extracted content has no usable recipe (title present but no ingredients or steps)'
  )
}
```
This guard must run before the `if (forceRefresh)` branch AND before the insert loop —
the current title-only check at line 191-193 can stay as an additional guard or be folded
into `isExtractedRecipeUsable` (which already checks title).

#### 1.2 Update `src/inngest/functions.ts`

**File:** `src/inngest/functions.ts`

**Goal:** Replace the full pipeline body with a thin wrapper that creates the Supabase
service-role client and delegates to `runExtractRecipe`.

**Contract:** The exported `extractRecipe` Inngest function stays at the same export name
and triggers event name `recipe/extract` — no caller changes.

```ts
export const extractRecipe = inngest.createFunction(
  { id: 'extract-recipe', retries: 3, triggers: { event: 'recipe/extract' } },
  async ({ event }) => {
    const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return runExtractRecipe(event.data as ExtractRecipeEvent, { fetch, supabase })
  }
)
```

#### 1.3 Fix send-failure path in `src/app/share/actions.ts`

**File:** `src/app/share/actions.ts`

**Goal:** When `inngest.send()` throws, the share row must be updated to
`status: 'failed'` so `getFailedShares()` surfaces it in the notification bell.

**Contract:** Replace the silent catch block (currently lines 70-72) with:
```ts
} catch (error) {
  console.error('Failed to trigger extraction task:', error)
  await supabase
    .from('recipe_shares')
    .update({ status: 'failed', error_message: 'Failed to queue extraction' })
    .eq('id', share.id)
}
```
The function should still return `{ shareId: share.id, message: ... }` even when the
send fails — the caller (share route) shows the confirmation; the bell will surface the
failure asynchronously. Alternatively: throw after marking failed, letting the route show
an error. Either behaviour is acceptable; marking as failed is the non-negotiable part.

#### 1.4 Add SSRF guard in `src/lib/recipe-image-archive.ts`

**File:** `src/lib/recipe-image-archive.ts`

**Goal:** Reject private/loopback/cloud-metadata addresses before `fetch()` is called,
preventing server-side request forgery via a content-controlled `og:image` URL.

**Contract:** Add a pure exported `isPrivateUrl(url: string): boolean` function above
`archiveImage`. At the top of `archiveImage`, before the `fetch`, call it and return
`null` early if matched.

The blocklist must cover at minimum:
- Loopback: `127.0.0.0/8`, `::1`, hostname `localhost`
- Private RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Link-local / metadata: `169.254.0.0/16`, hostname `169.254.169.254`,
  hostname `metadata.google.internal`
- Unspecified: `0.0.0.0`

Parse via `new URL(url)` and check `hostname`. Return `true` (is private) on parse
failure — an invalid URL should never be fetched.

Exporting `isPrivateUrl` is required so the integration test can assert the logic
directly without creating a full `archiveImage` test fixture.

### Criteria for Success

#### Automatic Verification

- `pnpm typecheck` passes — no TS errors in the refactored files
- `pnpm lint` passes — no unused imports after move
- `pnpm test` — existing unit tests (`content-quality.test.ts`, `firecrawl.test.ts`, etc.) still pass

#### Manual Verification

- Trigger a recipe extraction from the UI end-to-end; confirm a normal recipe is saved
  correctly (no regression from the refactor)
- Confirm `pnpm typecheck` and `pnpm lint` produce zero errors

---

## Phase 2: Integration Tests

### Overview

Three new test files — one per risk. All use Vitest with mocked Supabase fluent chains
and mocked `fetch`. No Inngest dev server, no real network calls.

### Required Changes

#### 2.1 `src/inngest/run-extract-recipe.test.ts` (Risk 2)

**File:** `src/inngest/run-extract-recipe.test.ts` (new file)

**Goal:** Prove that the pipeline rejects junk and title-only LLM output before any
Supabase write, that the force-refresh path is also guarded, and that the happy path
and gap-fill paths call Supabase correctly.

**Contract:** Import `runExtractRecipe` and `ExtractRecipeEvent` from
`@/inngest/run-extract-recipe`. Build a `makeSupabaseMock()` helper that returns a
chainable vi.fn() object satisfying the Supabase query-builder fluent interface.
Build a `makeFetchMock({ firecrawl, openai })` helper that routes by URL prefix.

Scenarios to cover (each a separate `it` block):

| Scenario | Risk | Expected outcome |
|---|---|---|
| Junk markdown AND junk html | 2 (input gate) | throws before `supabase.from('recipes').insert` is called |
| Valid markdown; LLM returns `{ title, ingredients: [], steps: [] }` | 2 (output gate) | throws before insert |
| Valid markdown; LLM returns `{ title, ingredients: [], steps: [] }`; `force: true` | 2 (force path) | throws before `supabase.from('recipes').update` |
| URL collision (`error.message` includes `recipes_user_source_url_uniq`) | dedup | `supabase.from('recipes').update` called with `youtube_id` when existing `youtube_id` is null |
| Happy path | smoke | insert called once; `recipe_shares` updated to `status: 'completed'` |

Note on mocking strategy: `runExtractRecipe` uses `deps.fetch` for Firecrawl and OpenAI;
both are URL-routed in the mock. The Blogger feed path (`fetchBloggerPost`) is imported
from `@/lib/blogger-feed` — mock that module with `vi.mock('@/lib/blogger-feed', ...)` to
return `null` for all non-Blogger URLs (or mock `isBlogspotUrl` to return `false`).

#### 2.2 `src/app/share/actions.test.ts` (Risk 3)

**File:** `src/app/share/actions.test.ts` (new file)

**Goal:** Prove that when `inngest.send()` throws, the share row is updated to
`status: 'failed'`.

**Contract:** `triggerRecipeExtraction` calls `createSupabaseServerClient()` (which uses
`server-only`) — mock this module. Also mock `@/inngest/client` so `inngest.send` can be
made to throw.

```
vi.mock('@/lib/supabase/server', ...)  // return mock supabase with spy
vi.mock('@/inngest/client', ...)       // inngest.send = vi.fn().mockRejectedValue(new Error('queue down'))
vi.mock('@/lib/recipe-dedup', ...)     // findExistingRecipeForUrl → { status: 'none', normalizedUrl: ... }
vi.mock('@/lib/detect-source-type', ...) // returns 'web_blog'
```

Scenario:
- `inngest.send()` rejects → `supabase.from('recipe_shares').update({ status: 'failed', ... }).eq('id', share.id)` is called.

#### 2.3 `src/lib/recipe-image-archive.test.ts` (Risk 6)

**File:** `src/lib/recipe-image-archive.test.ts` (new file)

**Goal:** Prove that `isPrivateUrl` correctly identifies private addresses and that
`archiveImage` returns `null` without fetching for those URLs.

**Contract:** Import `isPrivateUrl` and `archiveImage` from `@/lib/recipe-image-archive`.
Use `vi.stubGlobal('fetch', mockFetch)` to observe whether fetch is called.

`isPrivateUrl` unit checks (fast, no Supabase mock needed):
- `'http://localhost/image.jpg'` → true
- `'http://127.0.0.1/image.jpg'` → true
- `'http://169.254.169.254/latest/meta-data/'` → true
- `'http://metadata.google.internal/'` → true
- `'http://10.0.0.1/image.jpg'` → true
- `'http://192.168.1.1/image.jpg'` → true
- `'not-a-url'` → true (parse failure = reject)
- `'https://external-cdn.example.com/photo.jpg'` → false

`archiveImage` integration check:
- Private URL → returns `null`; the stubbed `fetch` was NOT called.
- Valid HTTPS URL with allowed MIME → fetch IS called (normal flow).

### Criteria for Success

#### Automatic Verification

- `pnpm test` — all new tests pass with no skips
- `pnpm typecheck` — no errors in new test files

#### Manual Verification

- Review failure messages in the junk/output-gate tests: error message should clearly
  name the rejection reason (not a generic assertion error)
- Confirm the SSRF test failure message when `fetch` is unexpectedly called is actionable

---

## Phase 3: Cookbook Update

### Overview

Update §6.2 in the test plan with the concrete integration test location, naming
convention, mock strategy, and run command — matching the §6.1 unit-test cookbook pattern.

### Required Changes

#### 3.1 Update `context/foundation/test-plan.md` §6.2

**File:** `context/foundation/test-plan.md`

**Goal:** Replace the `TBD` placeholder in §6.2 with a concrete cookbook entry covering
the integration test patterns shipped in Phase 2.

**Contract:** Replace the `### 6.2 Integration tests` section body with:
- Location and naming: `src/inngest/*.test.ts`, `src/app/**/*.test.ts`,
  `src/lib/*.test.ts` colocated with the module under test; suffix `.test.ts`
- Scope: pipeline orchestration logic with injected deps — no real DB, no real network
- Mock strategy: `vi.mock` for `server-only` modules; manual Supabase fluent-chain mock
  via `makeSupabaseMock()`; `vi.stubGlobal('fetch', ...)` or `makeFetchMock()` for HTTP
- Reference tests: `src/inngest/run-extract-recipe.test.ts` (dependency injection pattern),
  `src/app/share/actions.test.ts` (server-only module mock pattern),
  `src/lib/recipe-image-archive.test.ts` (pure guard export pattern)
- Run: `pnpm test` (same runner as unit tests — Vitest, `node` env, `@/` alias)

### Criteria for Success

#### Automatic Verification

- `pnpm test` — full suite still passes after the doc change

#### Manual Verification

- Read §6.2 and confirm a future contributor could add a new integration test for a new
  Inngest scenario without reading this plan

---

## Testing Strategy

### Unit Tests (pre-existing, must not regress)

All tests in Phase 1 already covered `looksUnextractable` and `isExtractedRecipeUsable`.
Phase 2 does not duplicate those; it tests the wired pipeline.

### Integration Tests (new — Phase 2)

Mocked external I/O; tests pipeline ordering guarantees and the three risk invariants.

### Manual Smoke

After Phase 1: one end-to-end extraction confirms no regression from the refactor.
After Phase 2: `pnpm test` is the primary gate; no additional manual test required.

## References

- Test plan (risk map, rollout table): `context/foundation/test-plan.md`
- Phase 1 unit tests (patterns to follow): `src/lib/content-quality.test.ts`
- Pipeline function: `src/inngest/functions.ts`
- Share action: `src/app/share/actions.ts`
- Image archive: `src/lib/recipe-image-archive.ts`
- Failed-shares bell query: `src/lib/failed-shares.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Add ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Production Code Hardening

#### Automatic

- [x] 1.1 `pnpm typecheck` passes after extracting `run-extract-recipe.ts` and wiring output gate
- [x] 1.2 `pnpm lint` passes — no unused imports after move
- [x] 1.3 `pnpm test` — existing unit tests pass (no regression from refactor)

#### Manual

- [x] 1.4 End-to-end recipe extraction works from UI after the refactor

### Phase 2: Integration Tests

#### Automatic

- [ ] 2.1 `pnpm test` — `run-extract-recipe.test.ts` passes (5 scenarios: junk input, title-only output, force-refresh+junk, gap-fill, happy path)
- [ ] 2.2 `pnpm test` — `actions.test.ts` passes (send-failure → share marked failed)
- [ ] 2.3 `pnpm test` — `recipe-image-archive.test.ts` passes (private URLs blocked, fetch not called)
- [ ] 2.4 `pnpm typecheck` — no errors in new test files

#### Manual

- [ ] 2.5 Review failure messages in junk/output-gate tests for actionability

### Phase 3: Cookbook Update

#### Automatic

- [ ] 3.1 `pnpm test` passes after §6.2 update (no code change, doc only)

#### Manual

- [ ] 3.2 §6.2 entry is self-contained — a contributor can add a new integration test from it alone
