---
date: 2026-06-15T00:00:00Z
researcher: Szymon
git_commit: e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17
branch: master
repository: spokospace/zapiszprzepis
topic: "Phase 1 — pure pipeline functions to unit-test (junk gate, source/id detection, ingredient grouping, Firecrawl builders)"
tags: [research, codebase, testing, pipeline, content-quality, youtube, blogger-feed, firecrawl, ingredients, vitest]
status: complete
last_updated: 2026-06-15
last_updated_by: Szymon
---

# Research: Phase 1 — pure pipeline functions to unit-test

**Date**: 2026-06-15T00:00:00Z
**Researcher**: Szymon
**Git Commit**: e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17
**Branch**: master
**Repository**: spokospace/zapiszprzepis

## Research Question

Implementing §3 **Phase 1** of `context/foundation/test-plan.md`: configure vitest and unit-test
the cheap, high-signal **pure functions** of the extraction pipeline. Ground three risks against
the current code:

- **Risk 2** — junk passes the quality gate and is stored as a real recipe.
- **Risk 4** — ingredients are mis-parsed / jsonb shape drifts / sections split wrong.
- **Risk 5** — wrong source-type or id detection routes a link into the wrong path.

Plus the Firecrawl option builders, and the current vitest infrastructure state.

## Summary

The pipeline's pure logic is **already cleanly factored into single-purpose modules under `src/lib`**
with zero IO — they import cleanly and need no mocks, making Phase 1 a low-friction unit pass. The
live pipeline is **`src/inngest/functions.ts`** (all four call sites use `inngest.send({ name: 'recipe/extract' })`);
`src/trigger/extract-recipe.ts` is **legacy/dead code** — a simpler twin that lacks the junk gate,
the `youtube` source type, and the `section` field. Tests must target the Inngest path's helpers.

The pure, no-mock Phase-1 target set is:

| Module | Pure exports | Risk |
|---|---|---|
| `src/lib/content-quality.ts` | `looksUnextractable` | 2 |
| `src/lib/detect-source-type.ts` | `detectSourceType` | 5 |
| `src/lib/youtube.ts` | `youtubeIdFromUrl`, `findEmbeddedYoutubeId`, `isYoutubeHost`, `normalizeHost` | 5 |
| `src/lib/blogger-feed.ts` | `isBlogspotUrl` (the rest of the file is IO) | 5 |
| `src/lib/firecrawl.ts` | `buildFirecrawlOptions`, `buildEmbedScanOptions` | (path selection for 2/5) |

Risk 4's grouping/parsing logic is **not yet extractable** — it lives inline inside an async React
Server Component (`src/app/(authenticated)/recipes/[slug]/page.tsx`). Phase 1 must **extract a pure
helper first** (e.g. `parseIngredients` + `groupBySection`) before it can be unit-tested. The only
already-importable ingredient function is `matchesQuery` in the recipes list page.

Infra gap: **vitest is installed (`^4.1.8`) but has no config, no `test` script, and no `@/` alias
wired for tests.** Phase 1 must add `vitest.config.ts` (with `@/ → ./src` alias, `include`
`src/**/*.test.ts`, `exclude` `e2e/`) and a `test` script. One placeholder test exists
(`src/lib/env.test.ts`) but asserts nothing real and is the naming convention to follow.

## Detailed Findings

### Risk 2 — Junk quality gate

**The only dedicated gate: `looksUnextractable(content: string): boolean`** — `src/lib/content-quality.ts:23-28`

```ts
export function looksUnextractable(content: string): boolean {
  const clean = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < MIN_CONTENT_CHARS) return true            // MIN_CONTENT_CHARS = 150
  const lower = clean.toLowerCase()
  return clean.length < 500 && JUNK_SIGNATURES.some((sig) => lower.includes(sig))
}
```

- **Pure**, deterministic, string-in/bool-out — *the* primary Risk-2 unit target.
- **Signature-based and brittle.** `JUNK_SIGNATURES` (`content-quality.ts:8-13`) is exactly 4 hardcoded
  substrings: `'rate this translation'`, `'improve google translate'`,
  `'przejdź do głównej zawartości'`, `'skip to main content'`. Magic thresholds: `MIN_CONTENT_CHARS = 150`
  (hard reject) and a `< 500` ceiling that gates the signature branch.
- **No field-presence check** — `looksUnextractable` never inspects ingredients/steps.

**Gate ordering** — `src/inngest/functions.ts:128`:

```ts
if (looksUnextractable(markdown) && looksUnextractable(html)) {
  throw new Error('Scraped page had no readable recipe content ...')
}
```

- Note the **`&&`**: rejects only when *both* markdown AND html look unextractable. Either field
  clearing the bar lets extraction proceed.
- Positionally the gate runs **before** the OpenAI call (`:132`) and before all three persist sites
  (force-refresh UPDATE `:199-216`, INSERT `:246-266`, gap-fill UPDATE `:326`).
- The **only post-LLM guard** is a title-presence check — `functions.ts:190-192`:
  ```ts
  if (!recipeJSON.title || typeof recipeJSON.title !== 'string') {
    throw new Error('No recipe title extracted ...')
  }
  ```
  It does **not** check that `ingredients` / `steps` are non-empty.

**Per-source-path coverage is uneven** (gate runs on raw scraped content, never on LLM output):

| Source path | `markdown`/`html` source | Gate effectiveness |
|---|---|---|
| Blog / Firecrawl (`web_blog`, `facebook_text`) | Firecrawl markdown + html (`functions.ts:103-117`) | Meaningful — this is what it was built for |
| Blogspot feed (`functions.ts:82-97`) | markdown from feed `title + stripped html`; `html = bloggerPost.html` | Rarely fires (feed only returns non-empty html) |
| YouTube | Firecrawl scrape of watch page; recipe text = description | A short/boilerplate description ≥150 chars of UI chrome can pass |

**Risk-2 fixtures the gate MISSES** (assert these to expose gaps for the plan):
1. Long non-recipe page (≥500 chars of prose / "About me" / shopping list) — clears both thresholds → LLM hallucinates → persisted. The biggest miss: no minimum *recipe* signal.
2. Google-Translate interstitial ≥500 chars — signature branch is gated on `< 500`, so verbose GT passes.
3. Polish-locale GT markers absent from the English-biased 4-item list.
4. One-field-clean junk — `&&` means junk html + 150-char nav-text markdown passes (or vice-versa).
5. Empty ingredients/steps with a valid title — passes the only post-LLM check; stored as a titled body-less recipe.
6. YouTube boilerplate description ≥150 chars → LLM invents a recipe.

**Fixtures the gate CATCHES** (regression assertions): whitespace-only / `<150` chars; `<500` chars
containing any signature; HTML-only junk (tags stripped first).

### Risk 5 — Source-type / id detection

Detection is three pure modules consumed by `src/inngest/functions.ts`. Host knowledge is centralized
in `youtube.ts` (`normalizeHost`) and reused by `detect-source-type.ts`.

**`detectSourceType(url): 'facebook_text' | 'web_blog' | 'youtube'`** — `src/lib/detect-source-type.ts:3`
- Pure. `facebook.com`/`fb.watch`/`fb.me` → `facebook_text`; YouTube host → `youtube`; **everything
  else (incl. blogspot AND malformed URLs via swallowed `catch`) → `web_blog`**.
- Blogspot is intentionally NOT a return value — blogspot routing happens later via `isBlogspotUrl`.
- Callers: `src/app/share/actions.ts:36`, `src/app/(authenticated)/recipes/add-recipe-action.ts:29`,
  `retry-action.ts:52`, `[slug]/refresh-action.ts:56`.

**`normalizeHost(host): string`** — `src/lib/youtube.ts:21` — strips `www.`, `m.`, `music.` (one each,
anchored at start, in that order). **Order-dependent traps:**
- `gaming.youtube.com` → not stripped → `isYoutubeHost` false → **misrouted to web_blog**.
- `www.m.youtube.com` → `youtube.com` ✓ ; `m.www.youtube.com` → `www.youtube.com` → **false**.

**`isYoutubeHost(host): boolean`** — `src/lib/youtube.ts:25` — `Set(['youtube.com','youtu.be','youtube-nocookie.com'])`. Takes a host string, not a URL.

**`youtubeIdFromUrl(url): string | null`** — `src/lib/youtube.ts:34` — id alphabet `/^[A-Za-z0-9_-]{11}$/`
(full-match, `:11`). Branches: non-YT host → null; `youtu.be/<id>`; `watch?v=`; `{shorts,embed,live}/<id>`.
- Handles `?si=`, `&t=`. **Does NOT handle `/v/<id>`** (old embed) → null. `playlist?list=` → null. `<11`-char id → null.
- No semantic validation: any 11-char alphabet segment is accepted.

**`findEmbeddedYoutubeId(html): string | null`** — `src/lib/youtube.ts:78` — regex (`:67-72`) scans HTML for
first embed; **does** match `/v/<id>` and `youtube-nocookie.com` (asymmetry vs `youtubeIdFromUrl` worth a fixture).

**`isBlogspotUrl(url): boolean`** — `src/lib/blogger-feed.ts:7` — `new URL(url).hostname.endsWith('.blogspot.com')`. Pure.
Checked first in the pipeline (`functions.ts:82`) regardless of source type → if true, takes the Blogger
JSON-feed path (`fetchBloggerPost`, IO) with a Firecrawl fallback.
- **Core Risk-5 miss:** country-coded blogspot domains (`blogspot.de`, `blogspot.co.uk`, `blogspot.com.au`)
  end with `.blogspot.de` etc., NOT `.blogspot.com` → returns **false** → skips the deterministic feed
  path → generic Firecrawl returns Google-Translate/empty junk. The most concrete "blogspot not detected" failure.

**Downstream branch selection** (`functions.ts`): `sourceType === 'web_blog'` triggers the parallel
`buildEmbedScanOptions` embed scan (`:103-113`); `youtube`/`facebook_text` skip it. YouTube id capture
(`:123`): `youtubeIdFromUrl(sharedUrl) ?? findEmbeddedYoutubeId(embedHtml || html)`.

**Near-miss fixture catalog** (grounded):

| Input URL | Expected | Actual / risk |
|---|---|---|
| `m.youtube.com/watch?v=<11>` | youtube + id | ✓ |
| `music.youtube.com/watch?v=<11>` | youtube | ✓ |
| `gaming.youtube.com/...` | youtube | ✗ → **web_blog** |
| `youtu.be/<11>?si=abc` | id | ✓ |
| `youtube.com/{shorts,embed,live}/<11>` | id | ✓ |
| `youtube.com/v/<11>` | id | ✗ `youtubeIdFromUrl` null; ✓ `findEmbeddedYoutubeId` |
| `youtube-nocookie.com/embed/<11>` | host+id | ✓ |
| `youtube.com/watch?list=PL...` (no v) | null id | ✓ |
| `youtube.com/watch?v=tooShort` | null id | ✓ |
| `foo.blogspot.com/...` | blogspot feed | ✓ |
| `foo.blogspot.de/...` | blogspot feed | ✗ → **generic Firecrawl (junk)** |
| `www.foo.blogspot.com/...` | blogspot feed | ✓ |
| `not a url` | web_blog, null id | ✓ |
| `fb.watch/abc`, `facebook.com/...` | facebook_text | ✓ |

### Risk 4 — Ingredient parsing / grouping / rendering

**No zod schema and no shared interface for ingredients.** The shape is defined informally in several
disagreeing places; the DB column is untyped `Json` (`src/lib/supabase.types.ts:98`). SQL comment
(`supabase/migrations/20260607000000_recipe_schema.sql:40,55-56`) documents `[{name, amount, unit}]`
— already stale (no `section`). Local `Ingredient` aliases disagree:
- `[slug]/page.tsx:24` — `name` **required**, has `section`.
- `recipes/page.tsx:8` — `name` **optional** (search path is more defensive).
- `functions.ts:25` (producer) — `name` required, has `section`.
- `trigger/extract-recipe.ts:18` (legacy producer) — no `section`.

`section` is a runtime LLM-prompt convention (`functions.ts:158`), validated nowhere.

**The grouping/render logic is inline in an async RSC** — `src/app/(authenticated)/recipes/[slug]/page.tsx:75-194`,
**not exported, not pure**. The grouping algorithm (`:82-88`) is run-length grouping on *contiguous* equal
`section`:

```ts
for (const ing of ingredients) {
  const section = (ing?.section ?? '').trim()
  const last = ingredientGroups.at(-1)
  if (last && last.section === section) last.items.push(ing)
  else ingredientGroups.push({ section, items: [ing] })
}
```

→ interleaved sections (A, B, A) silently produce **two separate "A" groups** — a real drift bug worth a fixture.

**Shape-drift tolerance** (parse at `:75-77`, group at `:83-88`, render at `:178-189`):
- String column → `JSON.parse`; non-JSON string → **throws, page crashes** (no try/catch).
- `null` column → `JSON.parse("null")` → null → `for...of` **throws "not iterable"**.
- Object not array → coerced to `"[object Object]"` → SyntaxError → crash.
- Missing `name` → renders `undefined` → **silently drops the ingredient** (no throw).
- `section: null` / bare-string element → graceful (`?.` + `?? ''`), but bare strings drop their text.
- Empty array → zero groups, silent.

The **defensive contrast** is `matchesQuery` (`recipes/page.tsx:29-41`) — a near-pure, module-scope,
**directly importable** function that explicitly guards `Array.isArray` and `typeof name === 'string'`.
It is the only ingredient function testable as-is today.

**Unit normalization:** there is **no pure unit/quantity parser** — EN→PL + metric conversion is delegated
entirely to the LLM prompt (`functions.ts:159`). `amount`/`unit` are free-form strings. So "unit confusion"
is **not unit-testable today**; only `formatMinutes` (`src/lib/format-minutes.ts`, cook times, not ingredients) is a pure numeric helper.

**Phase-1 implication:** to cover Risk 4 cheaply, **extract a pure `parseIngredients(json)` + `groupBySection(ingredients)`**
from the RSC, then unit-test it. Recommended malformed fixtures: string-but-valid-JSON; non-JSON string;
null; object-not-array; missing `name`; `section:null`; bare-string element; empty array; mixed flat+sectioned
contiguous; **interleaved sections (the bug fixture)**; whitespace `' Krem '` vs `'Krem'`.

### Firecrawl option builders — `src/lib/firecrawl.ts` (pure, zero IO)

**`buildFirecrawlOptions(url, sourceType, { fullContent = false })`** — `src/lib/firecrawl.ts:30`
- `formats: ['markdown','html']` hardcoded; `onlyMainContent: !fullContent` computed (core branch).
- `actions: [{type:'wait', milliseconds:2000}]` added only for `web_blog` and `youtube`.
- `excludeTags: BLOG_EXCLUDE_TAGS` (12-element list incl. `'iframe'`, `:14`) added ONLY for `web_blog` + `fullContent:true`.
- `youtube` never gets `excludeTags` (deliberate, comment `:53`); `facebook_text` → bare base.
- Distinct branches each worth one assertion: web_blog/no-full, web_blog/full, youtube, facebook_text.

**`buildEmbedScanOptions(url)`** — `src/lib/firecrawl.ts:71` — almost fully hardcoded (`formats:['html']`,
`onlyMainContent:false`, wait action, no excludeTags); good snapshot test. The IO (`fetch`, auth header,
45s timeout) lives in the caller `firecrawlScrape()` (`functions.ts:44-59`), not the builder.

### Vitest infrastructure state

- **Installed, not configured.** `vitest: ^4.1.8`, `@vitest/ui: ^4.1.8` in devDependencies (`package.json:42,49`).
  No coverage package. **No `vitest.config.ts` / `vite.config.ts`**, no `vitest` key in package.json,
  **no `test` script** (only `test:e2e` / `test:e2e:ui` for Playwright).
- **Path alias** `@/* → ./src/*` (`tsconfig.json:21-23`) — tests must reproduce it via `resolve.alias`
  or `vite-tsconfig-paths` since there's no config yet. Source uses `@/lib/...` imports.
- **One placeholder test:** `src/lib/env.test.ts` (imports `{describe,it,expect} from 'vitest'`, asserts
  nothing real, doesn't import `env.ts`). Naming convention to follow: `*.test.ts` colocated in `src`.
- **e2e** lives in `e2e/` (`add-recipe.spec.ts`, `auth.setup.ts`); `playwright.config.ts` `testDir: ./e2e`,
  `baseURL: http://localhost:3001`. Vitest `include` must capture `src/**/*.test.ts` and `exclude` `e2e/`
  to avoid colliding with Playwright `*.spec.ts`.
- **Module/env gotchas:** ESM (`module: esnext`, `moduleResolution: bundler`); `package.json` has **no `"type"`**.
  **`src/lib/env.ts` is a landmine:** `import 'server-only'` + top-level `requireEnv(...)` throw on import
  unless env vars set. The pure target modules above have **no `env.ts` dependency** and import cleanly —
  that's why they're the safe Phase-1 set; importing the pipeline (`functions.ts`) into a test would drag in `env.ts`.

## Code References

- `src/lib/content-quality.ts:8-13,17,23-28` — `JUNK_SIGNATURES`, `MIN_CONTENT_CHARS`, `looksUnextractable` (Risk 2 target)
- `src/inngest/functions.ts:128` — junk gate (`&&` of markdown/html) before persist
- `src/inngest/functions.ts:190-192` — only post-LLM guard (title presence)
- `src/inngest/functions.ts:199-216,246-266,326` — the three persist sites
- `src/inngest/functions.ts:82-117,123` — blogspot/youtube branch selection + id capture
- `src/lib/detect-source-type.ts:3` — `detectSourceType` (Risk 5)
- `src/lib/youtube.ts:11,21,25,34,67-72,78` — id alphabet, `normalizeHost`, `isYoutubeHost`, `youtubeIdFromUrl`, embed regex, `findEmbeddedYoutubeId`
- `src/lib/blogger-feed.ts:7` — `isBlogspotUrl` (pure); `:26` `fetchBloggerPost` (IO)
- `src/lib/firecrawl.ts:14,30,71` — `BLOG_EXCLUDE_TAGS`, `buildFirecrawlOptions`, `buildEmbedScanOptions`
- `src/app/(authenticated)/recipes/[slug]/page.tsx:24,75-88,178-194` — `Ingredient` type, inline parse+group+render (Risk 4; needs extraction)
- `src/app/(authenticated)/recipes/page.tsx:8,29-41` — defensive `matchesQuery` (only importable ingredient fn)
- `src/lib/supabase.types.ts:98` — untyped `ingredients: Json`
- `supabase/migrations/20260607000000_recipe_schema.sql:40,55-56` — SQL ingredient shape comment (stale)
- `src/lib/env.ts:1,11-12` — `server-only` + top-level throw (test import landmine)
- `src/lib/env.test.ts` — existing placeholder (naming convention)
- `package.json:42,49` — vitest deps; no `test` script; `tsconfig.json:21-23` — `@/` alias
- `playwright.config.ts`, `e2e/add-recipe.spec.ts`, `e2e/auth.setup.ts` — e2e to exclude from vitest
- **Dead code (do NOT target):** `src/trigger/extract-recipe.ts:13,18,75` — legacy twin, no junk gate, no `youtube`, no `section`

GitHub permalinks (commit `e0da8e4`):
- https://github.com/spokospace/zapiszprzepis/blob/e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17/src/lib/content-quality.ts#L23
- https://github.com/spokospace/zapiszprzepis/blob/e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17/src/lib/detect-source-type.ts#L3
- https://github.com/spokospace/zapiszprzepis/blob/e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17/src/lib/youtube.ts#L34
- https://github.com/spokospace/zapiszprzepis/blob/e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17/src/lib/firecrawl.ts#L30
- https://github.com/spokospace/zapiszprzepis/blob/e0da8e47c04e3f316fd5ef5778d8f784ba9a3a17/src/app/(authenticated)/recipes/%5Bslug%5D/page.tsx#L75

## Architecture Insights

- **Pure/IO split is already clean.** `src/lib` holds single-purpose pure helpers (`content-quality`,
  `detect-source-type`, `youtube`, `firecrawl`, `slugify`, `url-normalize`, `format-minutes`,
  `blogger-feed`'s `isBlogspotUrl`); IO orchestration is concentrated in `src/inngest/functions.ts`.
  Phase 1 leans entirely on the former and needs no mocks.
- **Two extraction implementations exist; only Inngest is live.** `src/trigger/extract-recipe.ts` is a
  legacy twin missing the gate, the `youtube` type, and `section`. The plan must assert against the Inngest
  helpers and treat the trigger file as out of scope (or flag it for deletion).
- **The gate guards input, never output.** Junk detection runs on scraped content; nothing validates the
  LLM's recipe (empty ingredients/steps pass). This is the structural reason Risk 2 survives — relevant to
  whether Phase 1 should also recommend a post-LLM assertion (or defer to Phase 2 integration tests).
- **Ingredient shape has no single source of truth.** Untyped `Json` column + 4 disagreeing local aliases
  + LLM-only `section` convention = the exact "shape drift" Risk 4 describes. A pure `parseIngredients`
  helper would both enable testing and become the de-facto schema boundary.

## Historical Context (from prior changes)

- Memory `s-04-youtube-pivot` — S-04 stores the YouTube video id + iframe (serverless can't run yt-dlp/Whisper).
  This is why `youtubeIdFromUrl` / `findEmbeddedYoutubeId` are load-bearing and worth thorough fixtures.
- Memory `blogspot-extraction-via-feed` — `*.blogspot.com` uses the Blogger JSON feed, not Firecrawl
  (which returns Google-Translate junk). This is why `isBlogspotUrl`'s `.blogspot.com`-only match (missing
  country-coded TLDs) is the headline Risk-5 gap.
- `context/foundation/test-plan.md` §2 — Risk Response Guidance rows 2/4/5 define exactly what each test
  must prove; this research grounds them to the functions above.

## Related Research

None prior — this is the first research artifact under `context/changes/test-pure-pipeline-units/`.

## Open Questions

1. **Scope of extraction for Risk 4.** Phase 1 says "pure functions"; the grouping logic is inline in an
   RSC. Does the plan extract `parseIngredients`/`groupBySection` now (recommended — small, high-signal),
   or defer Risk 4 to a later phase and cover only `matchesQuery` for now?
2. **Assert current behavior vs. assert desired behavior.** Several pure functions have known gaps
   (`gaming.youtube.com` misroute, `blogspot.de` miss, interleaved-section duplication, junk gate `&&`).
   Should Phase-1 tests pin *current* behavior (regression lock) or encode *desired* behavior (failing
   tests that drive a fix)? This is a plan-stage decision per function.
3. **Post-LLM junk assertion.** Empty ingredients/steps with a valid title currently persist. Is a
   post-LLM guard in scope for Phase 1 (pure validator function) or Phase 2 (integration, step ordering)?
4. **Dead trigger file.** Should `src/trigger/extract-recipe.ts` be deleted as part of this change to
   remove the divergent second implementation, or left untouched?
