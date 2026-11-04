# Recipes in multiple categories

> Issue: #689. Brief (durable copy): `.ai/specs/briefs/2026-11-04-multi-category-recipes.md`. Risk: **medium** (touches the `public_recipes` view, 3 SQL functions and ~7 query sites; additive, keeps the `category` contract). Design-only: no implementation in this PR. Related specs: `2026-10-17-category-tags-similar.md` ("Podobne", tag facets), `2026-10-28-admin-panel-roles-moderation-mcp.md` (admin taxonomy edit, MCP `recipes_set_taxonomy`).

## TLDR

`recipes.category` is one NOT NULL enum, so a dish lives in exactly one list. *Proposed (future behavior):* keep `category` as the **primary** category and add `extra_categories recipe_category[]` (max 2). A recipe with extras also appears in the `/przepisy/{extra}` listing and in that category's counts, facets, search filter and mirrors. Extras are chosen by the LLM at extraction (slice 2) and editable by admin in the panel and over MCP (slice 1). A `taxonomy_locked_at` marker stops re-extraction from overwriting manual taxonomy edits. Delivery is two slices: **slice 1** is the data model, manual edit, list/count queries and the overwrite lock (no LLM); **slice 2** is LLM assignment, backfill and a precision check.

## Problem Statement

- A dish that fits several lists is hidden from all but one: "przekąski" holds 113 recipes against "śniadania" 18 of 925 (2026-11-04). Sandwiches, baked sandwiches and stuffed eggs fit "przekąski" + "śniadania"; shell salads fit "przekąski" + "sałatki".
- A read-only sample of the 60 newest "przekąski" showed mostly genuine multi-fit dishes, not classifier mistakes. A better prompt or a one-off reclassification therefore does not solve it.
- Tags are overlapping labels but do not place a dish in a category list.
- Today re-extraction overwrites a manually fixed category and tags (the refresh path writes `category` and `tags` unconditionally), so any manual taxonomy fix is fragile.

## Proposed Solution

1. **Model (variant A).** `category` stays the primary. New column `extra_categories public.recipe_category[] not null default '{}'` with a GIN index. Database constraint: at most 2 elements, no duplicates, primary not among them, no NULL elements.
2. **Primary keeps driving** canonical URL, breadcrumbs, JSON-LD BreadcrumbList, OG image, category description/meta, "Podobne", the list-bar fallback and the MCP `recipes_set_taxonomy` `category` argument.
3. **Extras drive membership** in: `/przepisy/{extra}` listings, category facets and totals, the search category filter, the `/recipes` and `/u/{username}` category filters, the category `.md` mirror, sitemap/llms listings and usage stats.
4. **Manual edit (slice 1).** The admin recipe page gets an "extra categories" multi-select (max 2, the primary disabled); MCP `recipes_set_taxonomy` gets an optional `extra_categories` argument. Existing calls without it behave exactly as today.
5. **Overwrite lock (slice 1).** New `recipes.taxonomy_locked_at timestamptz`. `admin_set_taxonomy_as` sets it on every manual edit. The re-extraction refresh path skips `category`, `extra_categories` and `tags` when it is set. This also fixes today's overwrite of manual category/tags.
6. **LLM assignment (slice 2).** The extraction prompt returns `extra_categories` (0–2, from the closed list, never the primary); the app validates it (`toRecipeCategory`-style coercion, dedupe, drop primary, cap 2).
7. **Backfill (slice 2).** A one-off script classifies existing recipes for extras only; the primary is never touched; locked recipes are skipped. A ~30-recipe precision check is reviewed by the owner before the full write.

**Alternatives considered**
- *B: replace `category` with `categories[]`* — rejected: breaking for URLs, canonicals, MCP args and `public_recipes`; `risk-high`.
- *C: join table `recipe_categories`* — rejected: duplicates rows in `public_recipes` and every listing query.
- *D: build nothing / better prompt / tags only* — rejected: does not place a dish in two lists (see Problem).

## Architecture

All paths are the current locations; implementation verifies each against the code first.

- **DB.** `recipes` (new columns + constraint + `idx_recipes_extra_categories` GIN); `public_recipes` view re-created with the new column last (guarded re-creation with the last-column check, per the existing view-migration pattern); `category_tag_facets` and `recipe_category_context` (membership = `category = c OR extra_categories @> array[c]`); `search_recipes`; the `usage_stats` SQL; `admin_set_taxonomy_as` (new `p_extra_categories` argument, sets `taxonomy_locked_at`); `src/lib/supabase.types.ts` regenerated.
- **Queries.** `src/lib/recipe-cache.ts` (category listing, facets, total: the category filter becomes an `or` / array-contains predicate), `src/lib/public-recipe.ts` (`.md` route), `src/lib/search.ts`, `src/app/(authenticated)/recipes/page.tsx`, `src/app/u/[username]/page.tsx`, `src/lib/public-profile.ts` counts. One shared helper builds the membership predicate so no call site re-implements it.
- **Extraction (slice 2).** `src/inngest/run-extract-recipe.ts`: prompt, parsing/coercion, and the refresh path (`taxonomy_locked_at` guard). Backfill lives in `scripts/`.
- **Admin/MCP.** `src/app/admin/przepisy/[id]/page.tsx`, `actions.ts`, `src/lib/staff/recipes.ts` (`parseTaxonomy` gains `extraCategories`, max 2, no primary), `src/lib/staff/registry.ts`.

## Data Model

```sql
alter table public.recipes
  add column if not exists extra_categories public.recipe_category[] not null default '{}',
  add column if not exists taxonomy_locked_at timestamptz;
-- constraint (added idempotently): cardinality <= 2, primary not in extras,
-- no NULL elements, no duplicates
```
A CHECK cannot contain a subquery in Postgres, so distinctness is expressed with an immutable helper function (or a `BEFORE` trigger); the migration states which one and tests it. Max 2 is enforced in the database, not only the UI.

Migrations are idempotent and applied to production by hand through the Management API (local dev points at the production database). `public_recipes` is re-created with the existing guarded pattern; the apply step runs a smoke query against the view afterwards. Changing the primary through `admin_set_taxonomy_as` must remove a now-duplicate extra in the same statement, so the constraint never fails mid-edit.

## API Contracts

- `/recipes?category=` and `/przepisy/{kategoria}` URLs unchanged; the param now matches primary **or** extra.
- MCP `recipes_set_taxonomy`: existing args unchanged; new optional `extra_categories: string[]` (max 2, closed list, not the primary). Omitted = leave as is; `[]` = clear. Any manual call sets `taxonomy_locked_at`.
- `public_recipes`: one new trailing column `extra_categories`; no column removed or renamed.
- `admin_set_taxonomy_as(p_actor, p_recipe, p_category, p_tags, p_via, p_token_id, p_extra_categories text[] default null)`: new trailing defaulted argument; old callers keep working.
- Extraction JSON gains `"extra_categories": [...]` (slice 2); a missing or invalid value means `[]`.

`BACKWARD_COMPATIBILITY.md` surfaces touched: `/recipes?category=` params, MCP arg names, `public_recipes` columns. All changes are additive; no deprecation path is needed.

## UI/UX

Text-only: no new public screen.
- **Public lists** show the recipe card as today; a dish with extras simply appears in more lists. The recipe page stays on its primary category (breadcrumbs, "Podobne", canonical).
- **Counts.** Each list counts every recipe containing the category, so the sum of list counts may exceed the total number of recipes. ItemList JSON-LD and the sitemap count a recipe once per list it appears in.
- **Admin recipe page.** A labeled multi-select "Dodatkowe kategorie" (max 2) next to the category select; the primary is disabled in it; selecting a third shows a field error. Keeps the existing admin form conventions (labels, ≥ 48 px targets, WCAG 2.2 AA).

## Edge Cases & Failure Scenarios

- Primary changed to a value already in extras → the extra is dropped in the same update.
- A direct DB write with 3 extras, a repeated primary or a duplicate → the constraint rejects it.
- LLM returns the primary, duplicates, unknown values or more than 2 → coerced down (drop primary, dedupe, drop unknown, cap 2), never fails the insert.
- Refresh of a locked recipe → content fields refresh, taxonomy fields are skipped.
- A hidden recipe stays hidden in every list including extras (same visibility predicate).
- Cache: `revalidateRecipeCaches()` already clears category listings; a taxonomy edit must invalidate the category caches of both the old and the new primary and extras.
- A category whose members are all extras (zero primaries) is still a non-empty list; empty-state logic must use the membership predicate.

## Risks & Impact Review

| Risk | Severity | Mitigation |
|------|----------|------------|
| `public_recipes` re-creation breaks guest reads | High | Guarded re-creation with last-column check; post-apply smoke query; rollback script in the migration comment |
| A call site keeps filtering on `category =` only and silently omits extras | Medium | One shared membership helper; grep gate in the implementation PR (`.eq('category'`), a test per site |
| Counts disagree between facets, totals and listing | Medium | One predicate everywhere; test asserting facet total = listing total |
| Backfill mislabels recipes | Medium | Primary untouched; ~30-recipe precision check approved before the full write; backfill is re-runnable and skips locked rows |
| Query cost of `or` + array contains | Low | GIN index; verify with `explain` on the largest category |

## Phasing

**Slice 1 — data model + manual edit + queries + lock (no LLM).**
1. Migration: columns, constraint, GIN index, `public_recipes`, `admin_set_taxonomy_as`; regenerate `supabase.types.ts`.
2. Shared membership predicate; update the SQL functions (`category_tag_facets`, `recipe_category_context`, `search_recipes`, `usage_stats`) and all query sites listed above.
3. Admin multi-select + `actions.ts` + `parseTaxonomy`; MCP `recipes_set_taxonomy` `extra_categories`.
4. `taxonomy_locked_at`: set on manual edit; guard in the refresh path.
5. Tests: constraint behavior, predicate per site, count consistency, lock behavior, MCP backward compatibility. Shippable on its own; extras are filled by hand until slice 2.

**Slice 2 — LLM assignment + backfill + precision check.**
1. Extraction prompt and coercion for `extra_categories`.
2. Backfill script (dry-run default, locked rows skipped, primary untouched, resumable).
3. Precision check: run on ~30 sampled recipes, produce a review table, owner approves before the full run.
4. Full backfill applied with the owner's go (production data change).

## Open Questions

None open. Resolved from the brief:

| Question | Answer |
|----------|--------|
| Who assigns extras? | LLM at extraction + admin edit in panel |
| Data model | Primary `category` stays; new `extra_categories` array |
| Max extras | 2 (database constraint); primary not repeated in extras |
| Counts | Each list counts every recipe containing the category |
| "Podobne" | Unchanged: scoped to the primary category |
| Backfill | Required; primary untouched; ~30-recipe precision check first |
| Re-extraction | Must not overwrite manual edits: `taxonomy_locked_at` |
| Slicing | Slice 1 without LLM; slice 2 with LLM, backfill, precision check |

## Non-goals

- No removal or rename of `recipes.category` or enum values.
- No new category route or change to `/przepisy/{kategoria}` URLs and canonicals.
- No change to "Podobne" or dish-version grouping.
- No user-facing category editing.

## Changelog

- 2026-11-04 — initial spec (issue #689).
