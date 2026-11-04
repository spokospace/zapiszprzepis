# Let a recipe belong to several categories

- Date: 2026-11-04
- Category: feature
- Priority signal: medium — misfiled/dual-fit dishes are hidden from the browse lists users expect (przekąski 113 recipes vs śniadania 18 of 925)
- Risk signal: medium — touches the `public_recipes` view, 3 SQL functions and ~7 query sites, but is additive and keeps the `category` contract
- Routing: Next: om-prepare-issue "Implement: recipes in multiple categories — brief: .ai/specs/briefs/2026-11-04-multi-category-recipes.md"

## Problem

`recipes.category` is a single NOT NULL enum, so a dish lives in exactly one list. Many dishes fit several (sandwiches, baked sandwiches, stuffed eggs: przekąski + śniadania; shell salads: przekąski + sałatki). A read-only sample of the 60 newest przekąski (2026-11-04) showed mostly genuine multi-fit dishes, not classifier mistakes, so a better prompt or a one-off reclassification does not solve it. Tags already exist as overlapping labels but do not place a dish in a category list.

## Agreed direction

Variant A: keep `category` as the primary category and add `extra_categories recipe_category[]` (GIN index), max 2 extras (3 total).
- Primary still drives canonical URL, breadcrumbs, JSON-LD BreadcrumbList, OG image, category description/meta, "Podobne", list-bar fallback and the MCP `recipes_set_taxonomy` `category` arg.
- Extras make the recipe appear in `/przepisy/{extra}` listings, category facets/totals, search category filter, `/recipes` and `/u/{username}` category filters, category `.md` mirror, sitemap/llms listings and usage stats.
- Extras are assigned by the LLM at extraction and editable by admin in the panel (and MCP, additively).
- Rejected: B (replace with `categories[]`, breaking, `risk-high`), C (join table, duplicates in the view), D (build nothing / better prompt / tag only: does not place a dish in two lists).

## Resolved unknowns

| Question | Answer |
|----------|--------|
| Who assigns extras? | LLM at extraction + admin edit in panel |
| Data model | Primary `category` stays; new `extra_categories` array |
| Max extras | 2 (CHECK constraint in DB, not only UI); primary must not be repeated in extras |
| Counts | Each list counts every recipe that contains the category; sum of counts may exceed total recipes; ItemList/sitemap count a recipe once per list |
| "Podobne" | Unchanged: scoped to the primary category |
| Backfill | Required: one-off LLM classification of existing recipes, primary untouched, ~30-recipe precision check before writing all |
| Re-extraction | Must not overwrite manual edits: provenance marker (e.g. `taxonomy_locked_at`); also fixes the existing overwrite of manual category/tags |
| Slicing | Slice 1: column + constraint, admin/MCP manual edit, list and count queries, overwrite lock (no LLM). Slice 2: LLM assignment, backfill, precision check |

## Non-goals

- No removal or rename of `recipes.category` or enum values.
- No new category route or change to `/przepisy/{kategoria}` URLs and canonicals.
- No change to "Podobne" or dish-version grouping.
- No user-facing category editing.

## Affected areas (if known)

- DB: `recipes`, `public_recipes` view (guarded re-creation, last-column check), `category_tag_facets`, `recipe_category_context`, `search_recipes`, `usage_stats` SQL, `admin_set_taxonomy_as`, `src/lib/supabase.types.ts` regeneration; migrations applied by hand to prod.
- Queries: `src/lib/recipe-cache.ts`, `src/lib/public-recipe.ts` (md route), `src/lib/search.ts`, `src/app/(authenticated)/recipes/page.tsx`, `src/app/u/[username]/page.tsx`, `src/lib/public-profile.ts` counts.
- Extraction: `src/inngest/run-extract-recipe.ts` (prompt, `toRecipeCategory`, refresh path), scripts for backfill.
- Admin/MCP: `src/app/admin/przepisy/[id]/page.tsx`, `actions.ts`, `src/lib/staff/recipes.ts`, `src/lib/staff/registry.ts` (`recipes_set_taxonomy` stays backward compatible).
- Contracts: `BACKWARD_COMPATIBILITY.md` (`/recipes?category=` params, MCP arg names, `public_recipes` columns).
