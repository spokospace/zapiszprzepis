# Test pure pipeline units — Implementation Plan

## Overview

Configure vitest and unit-test the cheap, high-signal **pure functions** of the
extraction pipeline. This is §3 Phase 1 of `context/foundation/test-plan.md`,
covering Risk 2 (junk passes the gate), Risk 4 (ingredient mis-parse), and
Risk 5 (wrong source/id detection). The phase also fixes two obvious, low-risk
detection bugs the tests expose, extracts the Risk-4 grouping logic out of a
React Server Component so it becomes testable, adds a pure post-LLM recipe
validator, and removes the dead extraction twin so there is one source of truth.

## Current State Analysis

- **Vitest is installed but unconfigured.** `vitest ^4.1.8` + `@vitest/ui ^4.1.8`
  in devDependencies (`package.json:42,49`); **no `vitest.config.ts`, no `test`
  script, no `typecheck` script, no `@/` alias for tests.** One placeholder test
  (`src/lib/env.test.ts`) asserts nothing real.
- **The pure surface is clean and import-safe** — `content-quality.ts`,
  `detect-source-type.ts`, `youtube.ts`, `firecrawl.ts`, and `blogger-feed.ts`'s
  `isBlogspotUrl` have no dependency on `src/lib/env.ts` (which throws on import
  via `server-only` + top-level `requireEnv`). They need no mocks.
- **Risk-4 logic is trapped in an RSC.** `parseIngredients`/section-grouping is
  inline in `src/app/(authenticated)/recipes/[slug]/page.tsx:75-88`, not pure or
  importable. The parse at `:75-77` **crashes** on null / non-array / non-JSON
  string (no try/catch). The list page's `matchesQuery`
  (`recipes/page.tsx:29-41`) is the defensive contrast (guards `Array.isArray`).
- **Two obvious detection bugs** (grounded in research): `isBlogspotUrl`
  (`blogger-feed.ts:7`) matches only `.blogspot.com`, so country-coded blogspot
  (`blogspot.de`, `blogspot.co.uk`) misroutes to the junk Firecrawl path; and
  YouTube host detection (`youtube.ts:21-27`) only strips `www./m./music.`, so
  any other subdomain (`gaming.youtube.com`) is misrouted to `web_blog`.
- **Risk 2 gate guards input only.** `looksUnextractable` (`content-quality.ts:23`)
  runs on scraped content; the only post-LLM guard is a title-presence check
  (`functions.ts:190`). Empty ingredients/steps with a valid title persist.
- **Dead twin.** `src/trigger/extract-recipe.ts` (`extractRecipeTask`) is a
  divergent copy of the pipeline (no junk gate, no `youtube`, no `section`); it is
  unreferenced by app code (no `.trigger()` call, no import). The live pipeline is
  `src/inngest/functions.ts`. NOTE: `src/trigger/example.ts` is **still used** by
  the `src/app/test-trigger/` demo route, so it stays.

## Desired End State

`pnpm test` runs a green vitest suite covering every pure pipeline function with
risk-grounded fixtures (including characterization tests that pin known quirks).
`pnpm typecheck` exists. The two obvious detection bugs are fixed and covered.
Ingredient parsing/grouping is a tested pure module the detail page consumes (and
no longer crashes on malformed jsonb). A tested `isExtractedRecipeUsable`
validator exists (wiring deferred to rollout Phase 2). The dead `extract-recipe.ts`
is gone. `test-plan.md` §6.1 documents the cookbook entry and §3 Phase 1 is
marked complete.

### Key Discoveries:

- Pure, import-safe targets: `src/lib/{content-quality,detect-source-type,youtube,firecrawl}.ts` and `isBlogspotUrl` in `src/lib/blogger-feed.ts`.
- `tsconfig.json:21-23` defines `@/* → ./src/*`; vitest needs the alias mirrored (no `vite-tsconfig-paths` dep — use a manual `resolve.alias`).
- Convention: colocated `*.test.ts` in `src` (`src/lib/env.test.ts`). e2e uses `*.spec.ts` under `e2e/` (`playwright.config.ts`) and must be excluded from vitest.
- Producer recipe shape: `RecipeData` (`functions.ts:23-32`) — `title: string`, `ingredients: Array<{name; amount?; unit?; section?}>`, `steps: string[]`.
- Ingredient grouping today is contiguous run-length on `section` (`[slug]/page.tsx:82-88`) — interleaved sections produce duplicate headers (a quirk we pin, not fix).

## What we are NOT doing

- **No CI / GitHub Actions YAML.** test-plan §5 marks lint+typecheck "Required
  after §3 Phase 1"; this phase makes them locally runnable and *names* them.
  Wiring into CI is owned by M1 L5 / M2 L5 (per project module boundaries).
- **No integration/e2e tests** (Inngest step ordering, SSRF, share→recipe,
  archive durability) — rollout Phases 2–4.
- **No wiring of `isExtractedRecipeUsable` into the pipeline** — that's rollout
  Phase 2 (integration, junk-gate-before-persist). This phase only adds + tests it.
- **No unit/quantity normalization tests** — no pure parser exists (LLM-prompt
  only); not unit-testable today.
- **No fixing the other pinned quirks** (junk gate `&&`, GT-≥500 miss, interleaved
  section duplication) — characterization-tested only; fixes are a later change.
- **No `steps` parse hardening** in `[slug]/page.tsx:90-92` — only `ingredients`
  is in Risk-4 scope this phase.
- **No removal of `example.ts` / `test-trigger` route / `@trigger.dev` deps /
  `trigger.config.ts`** — `example.ts` is live (demo route). Full trigger.dev
  teardown is a separate follow-up change.

## Implementation Approach

Infrastructure first (Phase 1), then tests for the already-pure modules with the
two obvious fixes applied alongside their tests (Phase 2), then the Risk-4
extraction refactor (Phase 3), then the Risk-2 validator and dead-code removal
(Phase 4), then cookbook/state bookkeeping (Phase 5). Each phase is independently
green-able. Fixes are behavior changes scoped to the two named bugs; every other
current behavior is pinned with a characterization test (commented as a known
limitation) so the refactor stays faithful.

---

## Phase 1: Vitest infrastructure

### Overview

Make `pnpm test` run vitest against `src/**/*.test.ts` with the `@/` alias, and
add a `typecheck` script. Prove it green on the existing placeholder test.

### Changes Required:

#### 1. Vitest config

**File**: `vitest.config.ts` (new, repo root)

**Purpose**: Run vitest in a node environment over `src/**/*.test.ts`, resolving
the `@/` path alias the source uses, excluding the Playwright `e2e/` suite.

**Contract**: `defineConfig` from `vitest/config`; `test.environment: 'node'`,
`test.include: ['src/**/*.test.ts']`, `test.exclude` adds `e2e/**`; `resolve.alias`
maps `@` → absolute `./src`. ESM alias resolution is the one non-obvious bit:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'e2e/**', '.claude/**'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

#### 2. Scripts

**File**: `package.json`

**Purpose**: Add the test runner and a typecheck gate (test-plan §5).

**Contract**: add `"test": "vitest run"`, `"test:watch": "vitest"`,
`"test:ui": "vitest --ui"`, `"typecheck": "tsc --noEmit"`. Do not touch existing
scripts. (`.claude/worktrees/` is already git-ignored; the `exclude` above also
keeps vitest out of it.)

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm test` runs and the existing `src/lib/env.test.ts` passes
- [ ] `pnpm typecheck` runs clean
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] `pnpm test` discovers only `src/**/*.test.ts` (no `e2e/*.spec.ts`, no worktree copies)

**Uwaga implementacyjna**: After automated checks pass, STOP for human confirmation before Phase 2.

---

## Phase 2: Pure detection/quality/Firecrawl tests + two obvious fixes

### Overview

Unit-test the already-pure modules with risk-grounded fixtures; fix the two
obvious detection bugs (blogspot country-code, youtube subdomain) alongside their
tests. Pin every other current behavior with characterization tests.

### Changes Required:

#### 1. Blogspot country-code fix

**File**: `src/lib/blogger-feed.ts`

**Purpose**: Route country-coded blogspot domains (`blogspot.de`, `blogspot.co.uk`,
…) into the deterministic Blogger-feed path instead of the junk Firecrawl path
(Risk 5).

**Contract**: `isBlogspotUrl(url: string): boolean` keeps its signature; the
hostname test changes from `.endsWith('.blogspot.com')` to matching
`.blogspot.<tld>` (incl. two-part TLDs). Must NOT match a deceptive host like
`foo.blogspot.com.evil.com`. Anchor the match at the end of the hostname:

```ts
return /\.blogspot\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(new URL(url).hostname)
```

#### 2. YouTube subdomain fix

**File**: `src/lib/youtube.ts`

**Purpose**: Treat any subdomain of a YouTube host (e.g. `gaming.youtube.com`,
`studio.youtube.com`) as YouTube, so `detectSourceType` and id extraction stop
misrouting them to `web_blog` (Risk 5).

**Contract**: `isYoutubeHost(host)` returns true when the normalized host equals
OR ends with `.` + a known host (`youtube.com`, `youtu.be`, `youtube-nocookie.com`).
`youtubeIdFromUrl` gates on `isYoutubeHost(parsed.hostname)` instead of the exact
`YOUTUBE_HOSTS.has(host)` check; the `youtu.be` path-id branch still matches
`host === 'youtu.be'` (subdomains of youtu.be do not occur). `normalizeHost`
signature unchanged. `detect-source-type.ts` needs no change (it delegates to
`isYoutubeHost`).

#### 3. Tests — content quality

**File**: `src/lib/content-quality.test.ts` (new)

**Purpose**: Cover `looksUnextractable` — both the cases it catches (regression
lock) and the cases it misses (characterization, Risk 2).

**Contract**: Assert TRUE for: whitespace-only, `<150` chars, `<500` chars
containing each `JUNK_SIGNATURES` entry, HTML-only junk (tags stripped). Assert
FALSE (documented MISS) for: ≥500-char Google-Translate text, Polish-locale GT
markers not in the list, a long non-recipe page. Each miss carries a comment that
it is a known limitation pinned for a later change.

#### 4. Tests — source-type detection

**File**: `src/lib/detect-source-type.test.ts` (new)

**Purpose**: Cover `detectSourceType` routing, including the youtube-subdomain fix.

**Contract**: facebook.com/fb.watch/fb.me → `facebook_text`; youtube.com,
youtu.be, m./music./www. youtube, **gaming.youtube.com (now `youtube`)** → `youtube`;
`*.blogspot.com` and a generic blog and a malformed string → `web_blog`.

#### 5. Tests — youtube helpers

**File**: `src/lib/youtube.test.ts` (new)

**Purpose**: Cover `normalizeHost`, `isYoutubeHost` (incl. subdomain fix),
`youtubeIdFromUrl`, `findEmbeddedYoutubeId` against the research fixture catalog.

**Contract**: From research §"Near-miss fixture catalog": `watch?v=`, `youtu.be/<id>?si=`,
`shorts|embed|live/<id>`, `m./music.` hosts, `gaming.youtube.com/watch?v=` → id;
`/v/<id>` → null from `youtubeIdFromUrl` but found by `findEmbeddedYoutubeId`
(assert the asymmetry); `playlist?list=` and sub-11-char ids → null;
`youtube-nocookie.com/embed/<id>` → id.

#### 6. Tests — blogspot detection

**File**: `src/lib/blogger-feed.test.ts` (new)

**Purpose**: Cover `isBlogspotUrl` incl. the country-code fix. (Only the pure
function — `fetchBloggerPost` is IO, out of scope.)

**Contract**: TRUE for `foo.blogspot.com`, `www.foo.blogspot.com`,
**`foo.blogspot.de`, `foo.blogspot.co.uk`**; FALSE for `foo.blogspot.com.evil.com`,
a non-blogspot blog, and a malformed string.

#### 7. Tests — Firecrawl builders

**File**: `src/lib/firecrawl.test.ts` (new)

**Purpose**: Lock the per-source option branches.

**Contract**: `buildFirecrawlOptions`: `web_blog`/no-full → has `actions`, no
`excludeTags`, `onlyMainContent:true`; `web_blog`/full → `actions` + `excludeTags`
(incl. `iframe`), `onlyMainContent:false`; `youtube` → `actions`, never
`excludeTags`; `facebook_text` → bare base (no `actions`). `buildEmbedScanOptions`
→ `formats:['html']`, `onlyMainContent:false`, wait action, no `excludeTags`.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm test` passes (all new specs green)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` passes
- [ ] `detectSourceType('https://gaming.youtube.com/watch?v=...')` returns `youtube` (asserted in spec)
- [ ] `isBlogspotUrl('https://x.blogspot.de/p.html')` returns `true` (asserted in spec)

#### Manual Verification:
- [ ] Characterization tests for known misses carry a comment marking them as pinned limitations
- [ ] No production behavior changed beyond the two named fixes

**Uwaga implementacyjna**: STOP for human confirmation before Phase 3.

---

## Phase 3: Risk 4 — extract ingredient helpers

### Overview

Extract the ingredient parse + section-grouping out of the RSC into a pure,
tested `src/lib/ingredients.ts`; harden parsing against the documented crashes;
refactor the detail page to consume it. Grouping behavior is preserved exactly.

### Changes Required:

#### 1. Ingredient helpers module

**File**: `src/lib/ingredients.ts` (new)

**Purpose**: Own the canonical `Ingredient` type, a crash-safe `parseIngredients`,
and a behavior-preserving `groupBySection`.

**Contract**:
- `export type Ingredient = { name?: string; amount?: string; unit?: string; section?: string }` (lenient `name?`, matching the defensive list-page type).
- `parseIngredients(raw: unknown): Ingredient[]` — array → returned as-is; string → `JSON.parse`, return only if the result is an array, else `[]`; null / object / number / parse-error → `[]`. Never throws. (This replaces the crashing inline parse at `[slug]/page.tsx:75-77`, mirroring the `Array.isArray` guard already in `matchesQuery`.)
- `groupBySection(ingredients: Ingredient[]): { section: string; items: Ingredient[] }[]` — exact reproduction of the current contiguous run-length grouping (`[slug]/page.tsx:82-88`), `section = (ing?.section ?? '').trim()`. Interleaved same-section runs intentionally produce separate groups (pinned quirk).

#### 2. Refactor the detail page

**File**: `src/app/(authenticated)/recipes/[slug]/page.tsx`

**Purpose**: Consume the new helpers; remove the inline parse+group; stop crashing
on malformed jsonb.

**Contract**: Import `{ parseIngredients, groupBySection, type Ingredient }` from
`@/lib/ingredients` (add import + first usage in the same edit). Replace lines
75-88 with `const ingredients = parseIngredients(typedRecipe.ingredients)` and
`const ingredientGroups = groupBySection(ingredients)`. Remove the now-duplicate
local `Ingredient` type alias (`:24`). Render JSX unchanged. `steps` parsing
(`:90-92`) left as-is.

#### 3. Tests — ingredients

**File**: `src/lib/ingredients.test.ts` (new)

**Purpose**: Cover the malformed-input matrix and the grouping quirk.

**Contract**: `parseIngredients`: array → same; valid-JSON-array string → parsed;
non-JSON string, `null`, object-not-array → `[]` (no throw). `groupBySection`:
flat list → one unlabeled group; contiguous sections → grouped; `section:null`/
whitespace → trimmed/unlabeled; **interleaved `[A,B,A]` → 3 groups** (commented as
pinned quirk); missing `name` element preserved (not dropped); empty array → `[]`.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm test` passes (ingredients spec green)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` passes (new import survived the formatter)

#### Manual Verification:
- [ ] Detail page renders a real recipe (flat and sectioned) identically to before
- [ ] A recipe with malformed/empty ingredients renders without crashing (degrades to empty list)

**Uwaga implementacyjna**: STOP for human confirmation before Phase 4.

---

## Phase 4: Risk 2 validator + dead-code removal

### Overview

Add a pure post-LLM recipe validator (tested, not yet wired) and delete the dead
extraction twin so the Inngest pipeline is the single source of truth.

### Changes Required:

#### 1. Post-LLM recipe validator

**File**: `src/lib/content-quality.ts`

**Purpose**: A pure predicate the pipeline can later use to reject an LLM result
that has a title but no real body (the documented Risk-2 miss). Phase 1 adds +
tests it; wiring is rollout Phase 2.

**Contract**: `export function isExtractedRecipeUsable(recipe: { title?: unknown;
ingredients?: unknown; steps?: unknown }): boolean` — true iff `title` is a
non-empty (trimmed) string AND `ingredients` is a non-empty array AND `steps` is a
non-empty array. No IO.

#### 2. Tests — validator

**File**: `src/lib/content-quality.test.ts` (extend Phase-2 file)

**Contract**: true for a well-formed recipe; false for empty/whitespace title,
empty ingredients, empty steps, missing fields, non-array shapes.

#### 3. Remove dead twin

**File**: `src/trigger/extract-recipe.ts` (delete)

**Purpose**: Remove the divergent pipeline copy (no junk gate, no `youtube`, no
`section`) flagged by research. Confirmed unreferenced (no `.trigger()`, no import).

**Contract**: Delete the file. Do NOT touch `src/trigger/example.ts` (used by the
`test-trigger` demo route), `trigger.config.ts`, or `@trigger.dev` deps.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm test` passes (validator specs green)
- [ ] `pnpm typecheck` clean (no dangling reference to the deleted file)
- [ ] `pnpm lint` passes
- [ ] `grep -r extractRecipeTask src` returns nothing

#### Manual Verification:
- [ ] `test-trigger` demo route still builds (example.ts untouched)

**Uwaga implementacyjna**: STOP for human confirmation before Phase 5.

---

## Phase 5: Cookbook + rollout state

### Overview

Record the reusable test pattern in the test-plan cookbook and advance the
rollout state — the per-phase bookkeeping the test-plan workflow requires.

### Changes Required:

#### 1. Cookbook §6.1

**File**: `context/foundation/test-plan.md`

**Purpose**: Replace the §6.1 TBD with the concrete unit-test recipe.

**Contract**: Fill §6.1 with: location (`src/lib/<module>.test.ts`, colocated),
naming (`*.test.ts`), a reference test (point at `src/lib/firecrawl.test.ts` as
the canonical pure-function example), and the run command (`pnpm test` /
`pnpm test:watch`). Note the `@/` alias + node env config in `vitest.config.ts`.

#### 2. Rollout state §3

**File**: `context/foundation/test-plan.md`

**Purpose**: Mark §3 Phase 1 row `complete` and record the change folder.

**Contract**: Set the Phase 1 row Status to `complete` and Change folder to
`test-pure-pipeline-units`. Note in §5 that lint+typecheck+unit gates are now
locally runnable (CI wiring still pending per module boundary).

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm test && pnpm typecheck && pnpm lint` all green

#### Manual Verification:
- [ ] test-plan §6.1 reads as a usable "how to add a unit test here" recipe
- [ ] §3 Phase 1 shows `complete` with the change folder

---

## Testing Strategy

### Unit tests:
- Pure functions only, no mocks: `content-quality`, `detect-source-type`,
  `youtube`, `blogger-feed` (`isBlogspotUrl`), `firecrawl`, `ingredients`.
- Two categories per module: **regression locks** (current correct behavior) and
  **characterization tests** (known misses/quirks, commented as pinned).
- Fixture sources: research.md near-miss catalog (Risk 5), junk patterns (Risk 2),
  malformed-jsonb matrix (Risk 4).

### Integration tests:
- None this phase (rollout Phase 2).

### Manual testing steps:
1. `pnpm test` green; `pnpm typecheck`, `pnpm lint` clean.
2. Open a real sectioned recipe — renders identically to before the refactor.
3. (If available) open a recipe with empty/malformed ingredients — no crash.
4. Confirm `test-trigger` demo route still builds.

## Performance Considerations

None — pure functions, sub-millisecond tests.

## Migration Notes

No data migration. The detail-page parse change is strictly safer (graceful empty
instead of crash). Deleting `extract-recipe.ts` removes an unused trigger.dev task
registration; `example.ts` and the trigger.dev config stay.

## References

- Research: `context/changes/test-pure-pipeline-units/research.md`
- Test strategy: `context/foundation/test-plan.md` §2 (Risk Response Guidance), §3 Phase 1, §5, §6.1
- Reference test pattern (after Phase 2): `src/lib/firecrawl.test.ts`
- Existing test convention: `src/lib/env.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vitest infrastructure

#### Automated
- [x] 1.1 `pnpm test` runs and existing `env.test.ts` passes — c95a00c
- [x] 1.2 `pnpm typecheck` runs clean — c95a00c
- [x] 1.3 `pnpm lint` passes — c95a00c

#### Manual
- [x] 1.4 vitest discovers only `src/**/*.test.ts` (no e2e, no worktree) — c95a00c

### Phase 2: Pure detection/quality/Firecrawl tests + two obvious fixes

#### Automated
- [x] 2.1 `pnpm test` passes (all new specs green) — e86fead
- [x] 2.2 `pnpm typecheck` clean — e86fead
- [x] 2.3 `pnpm lint` passes — e86fead
- [x] 2.4 `gaming.youtube.com` → `youtube` asserted green — e86fead
- [x] 2.5 `blogspot.de` → `true` asserted green — e86fead

#### Manual
- [x] 2.6 Characterization tests comment-marked as pinned limitations — e86fead
- [x] 2.7 No production behavior changed beyond the two named fixes — e86fead

### Phase 3: Risk 4 — extract ingredient helpers

#### Automated
- [x] 3.1 `pnpm test` passes (ingredients spec green) — 1939f57
- [x] 3.2 `pnpm typecheck` clean — 1939f57
- [x] 3.3 `pnpm lint` passes (new import survived formatter) — 1939f57

#### Manual
- [x] 3.4 Detail page renders flat + sectioned recipe identically to before — 1939f57
- [x] 3.5 Malformed/empty ingredients render without crashing — 1939f57

### Phase 4: Risk 2 validator + dead-code removal

#### Automated
- [x] 4.1 `pnpm test` passes (validator specs green) — 61dca94
- [x] 4.2 `pnpm typecheck` clean (no dangling reference) — 61dca94
- [x] 4.3 `pnpm lint` passes — 61dca94
- [x] 4.4 `grep -r extractRecipeTask src` returns nothing — 61dca94

#### Manual
- [x] 4.5 `test-trigger` demo route still builds (example.ts untouched) — 61dca94

### Phase 5: Cookbook + rollout state

#### Automated
- [x] 5.1 `pnpm test && pnpm typecheck && pnpm lint` all green

#### Manual
- [x] 5.2 test-plan §6.1 reads as a usable unit-test recipe
- [x] 5.3 §3 Phase 1 shows `complete` with the change folder
