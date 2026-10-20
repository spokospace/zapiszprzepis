# Execution plan — sitemap + robots (Phase 1)

**Source doc:** `.ai/specs/2026-10-20-sitemap-and-md-alternates.md` (Phase 1 only)
**Issue:** #363

## Goal
Make every public page of `zapiszprzepis.pl` crawler-discoverable: serve a generated
`/sitemap.xml` and `/robots.txt`. Phase 2 (`.md` alternates + `llms.txt`) is NOT in scope.

## Scope
- `supabase/migrations/*` — add `last_modified` to the `public_recipes` view (append-only, idempotent).
- `src/app/przepis/[slug]/load-recipe.ts` — add `last_modified` to the `PublicRecipe` type.
- `src/lib/public-recipe.ts` (new) — shared, apply-order-safe `listCanonicalRecipes()` (oldest-wins
  dedup by slug) used by the sitemap.
- `src/app/robots.ts`, `src/app/sitemap.ts` (new) — the metadata routes.
- `src/middleware.ts` — exclude `/robots.txt` and `/sitemap.xml` from the matcher so anon crawlers
  reach them (today they'd be redirected to `/login`).

## Non-goals
- No `.md` alternates, no `llms.txt`, no `canonicalRecipeBySlug` (Phase 2's only consumer — deferred).
- No change to existing recipe/category/profile rendering.
- No applying the migration to prod in this run — the file ships in the PR; the SQL is surfaced for
  the owner to apply via the Management API around deploy (prod-DDL stays a confirmed manual step).

## Risks
- **Apply order:** Workers Builds deploys from `master` on merge; the migration may not be applied to
  prod at that instant. `listCanonicalRecipes` therefore selects `last_modified` but retries without it
  (falling back to `created_at`) on an undefined-column error, so the sitemap works in either DB state.
- **Worker 3 MiB limit:** middleware change is a few characters in the matcher regex — negligible.
- **Duplicate slugs** pre global-unique migration: dedup to the oldest row (`created_at`, then `id`).

## Implementation Plan

### Phase 1: Shared data + view migration
- 1.1 Migration: append `coalesce(updated_at, created_at) as last_modified` to `public_recipes`
  (idempotent, asserts current last column is `variant_note` before appending); extend `PublicRecipe`.
- 1.2 `src/lib/public-recipe.ts`: `listCanonicalRecipes()` — distinct-by-slug, oldest-wins, apply-order-
  safe select; unit tests (dedup winner, fallback-on-missing-column).

### Phase 2: robots + sitemap routes
- 2.1 `src/app/robots.ts` — allow public, disallow api/authenticated/search-param paths, `Sitemap:` line; test.
- 2.2 `src/app/sitemap.ts` — `listCanonicalRecipes()` + distinct author profiles + static set (home, 12
  categories, 3 legal paths, bare `/szukaj`), DB-failure fallback to the static set; test.
- 2.3 `src/middleware.ts` — exclude `robots.txt`/`sitemap.xml` from the matcher; extend `middleware.test.ts`.
- 2.4 Cache headers (`revalidate`) + full validation gate (`pnpm typecheck && pnpm lint && pnpm test`).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared data + view migration

- [x] 1.1 Migration: last_modified on public_recipes + PublicRecipe type — 4dfd1ad
- [x] 1.2 src/lib/public-recipe.ts listCanonicalRecipes + tests — 4dfd1ad

### Phase 2: robots + sitemap routes

- [ ] 2.1 app/robots.ts + test
- [ ] 2.2 app/sitemap.ts + test
- [ ] 2.3 middleware matcher exclusion + test
- [ ] 2.4 cache headers + full validation gate
