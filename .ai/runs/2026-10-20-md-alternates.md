# Execution plan — Markdown alternates + llms.txt (Phase 2)

**Source doc:** `.ai/specs/2026-10-20-sitemap-and-md-alternates.md` (Phase 2)
**Issue:** #363 (Phase 1 shipped in #364; this PR uses `Refs #363`, not `Closes`, so the issue stays open)

## Goal
Serve a clean Markdown rendering of every recipe and category page at a `.md` suffix URL
(`/przepis/{slug}.md`, `/przepisy/{kategoria}.md`), advertise it from the HTML head, and index it
all in a root `/llms.txt` — so an AI agent can fetch quotable, citable Markdown.

## Scope
- `src/lib/recipe-markdown.ts`, `src/lib/category-markdown.ts` (new, pure) — reuse parseIngredients/
  groupBySection, parseSteps, sourceLabel/originalLinkLabel, buildFallbackMetaDescription, recipePath.
- `src/lib/public-recipe.ts` — add `canonicalRecipeBySlug(slug)` (deferred from Phase 1; same oldest-wins rule).
- `src/app/przepis/[slug]/md/route.ts`, `src/app/przepisy/[kategoria]/md/route.ts` (new) — the `.md` handlers.
- `src/app/llms.txt/route.ts` (new) — the llms.txt index.
- `src/middleware.ts` — rewrite `*.md` content URLs to the handlers; exclude `llms.txt` from the matcher.
- `src/app/przepis/[slug]/page.tsx`, `src/app/przepisy/[kategoria]/page.tsx` — `alternates.types['text/markdown']` in generateMetadata.

## Non-goals
- No `.md` for profiles, home, legal, or search (spec scopes Phase 2 to recipes + categories).
- No `llms-full.txt`. No change to the sitemap/robots shipped in Phase 1 beyond the matcher.
- No new DB columns (Phase 1's view change is enough).

## Risks
- **Worker 3 MiB limit (hard, broke prod in #119):** new handlers + a few middleware lines + two pure
  builders — all small, but the final step runs `opennextjs-cloudflare preview` to confirm the bundle
  still uploads. Markdown builders reuse existing parse helpers, adding no heavy deps.
- **Routing:** Next dynamic segments can't carry a `.md` extension, so middleware rewrites
  `/przepis/{slug}.md` → `/przepis/{slug}/md` (internal), returning before the auth gate so anon
  crawlers aren't bounced to /login. Placed after the merged-recipe/legacy redirect.
- **Guest-safe:** handlers read only `public_recipes`; Markdown is text (no gallery), so nothing gated leaks.

## Implementation Plan

### Phase 1: Pure Markdown builders
- 1.1 `src/lib/recipe-markdown.ts` — `recipeToMarkdown(row, { siteUrl })`, fixed section order per the
  spec contract; unit tests (grouped ingredients, numbered steps, missing description, YouTube source).
- 1.2 `src/lib/category-markdown.ts` — `categoryToMarkdown(category, rows, { siteUrl })` → H1 + list
  linking each recipe `.md`; unit tests.

### Phase 2: Routes, routing and head wiring
- 2.1 `canonicalRecipeBySlug(slug)` in `src/lib/public-recipe.ts` (oldest-wins) + test.
- 2.2 Recipe `.md` handler `app/przepis/[slug]/md/route.ts` (404 on miss; markdown + noindex/canonical/cache headers) + test.
- 2.3 Category `.md` handler `app/przepisy/[kategoria]/md/route.ts` (isRecipeCategory guard) + test.
- 2.4 Middleware `.md` rewrite + isPublicRoute `.md` shapes; extend `src/middleware.test.ts`.
- 2.5 Head advertisement: `alternates.types['text/markdown']` in the recipe + category generateMetadata + tests.
- 2.6 `app/llms.txt/route.ts` (H1 + summary + `## Kategorie` + `## Przepisy`) + matcher exclusion + test.
- 2.7 Full validation gate + `opennextjs-cloudflare preview` bundle-size check.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pure Markdown builders

- [ ] 1.1 recipe-markdown.ts + tests
- [ ] 1.2 category-markdown.ts + tests

### Phase 2: Routes, routing and head wiring

- [ ] 2.1 canonicalRecipeBySlug + test
- [ ] 2.2 recipe .md route handler + test
- [ ] 2.3 category .md route handler + test
- [ ] 2.4 middleware .md rewrite + isPublicRoute + test
- [ ] 2.5 head advertisement (recipe + category metadata) + tests
- [ ] 2.6 llms.txt route + matcher exclusion + test
- [ ] 2.7 full validation gate + bundle-size check
