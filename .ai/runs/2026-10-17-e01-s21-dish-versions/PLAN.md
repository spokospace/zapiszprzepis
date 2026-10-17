# Run: E01-S21 — Versions of the same dish (Phase 1)

- **Issue:** #296 (epic #201) · **Spec PR:** #297 (design-only, merged)
- **Source doc:** `.ai/specs/2026-10-17-e01-s21-dish-versions.md`
- **Base branch:** master · **Branch:** `claude/e01-s21-dish-versions-impl-5712f6`
- **Scope:** Phase 1 ONLY (schema migration checked-in, runtime classification, recipe-page UI), behind empty data.

## Tasks

| Phase | Step | Title | Exec | Status | Commit |
|---|---|---|---|---|---|
| 1 | 1.1 | Migration `…_recipe_dish_versions.sql` (view append + order assertion, index, `dish_versions`/`dish_vocabulary` RPCs, grants) + `.ai/qa/s21-rehearse-dish-versions.sql` | inline | done | this commit |
| 1 | 1.2 | `src/lib/recipe-dish.ts` pure helpers (`normalizeDish`/`resolveDishAccusative`/`resolveVariantNote`/`dishVocabularyFor`) + tests | inline | done | this commit |
| 1 | 1.3 | Export `postChatJson`; add `classifyDish`/`writeVariantNote` (never throw) + tests | inline | done | this commit |
| 1 | 1.4 | Wire into `run-extract-recipe.ts` (vocab RPC ∥ existing query; dish ∥ labelRecipe; note after; insert / own-row gap-fill / refresh, all guarded on `dish_classified_at is null`) + tests | inline | done | this commit |
| 1 | 1.5 | `src/lib/dish-versions.ts` render helpers (`ingredientKey`/`ingredientDiff`/`versionBadges`/`versionsBarLabel`/`versionsHeading`/`sortVersions`/`parseVersionsSort`) + tests | inline | todo | |
| 1 | 1.6 | Recipe-page UI: `dish-versions-bar.tsx`, `dish-versions.tsx`, `dish-versions-sort.tsx`; `RecipeHeader` `versionsBar` slot; `page.tsx` RPC only when `recipe.dish` non-null + tests | inline | todo | |
| 1 | 1.7 | `SimilarRecipes` `dish` prop + `.or('dish.is.null,dish.neq."<dish>"')` filter + test | inline | todo | |
| 1 | 1.8 | Reflow: confirm recipe page covered at 320 px / A++ (empty-data shell already in `e2e/reflow.spec.ts`); final gate | inline | todo | |

## Goal
Every recipe can carry a normalized `dish` + `variant_note`; the recipe page shows a "N inne przepisy na {danie}" bar and an "Inne przepisy na {danie}" versions section (sortable), and "Podobne" stops repeating same-dish recipes. New recipes get classified in the labelling pass. Renders gracefully behind empty data (no bar/section/RPC call until a `dish` exists).

## Non-goals (Phase 2 / out of scope)
- The #298 backfill data migration, its group report, rollback script, `s21b` rehearsal.
- Applying the schema migration (owner applies it via the Supabase Management API).
- Regenerating `supabase.types.ts` (project convention: untyped server client + optional view-field augmentation, cf. `load-recipe.ts`).

## Risks
- Public contract: 3 appended view columns + 1 guest-facing RPC exposing a favorites **count** (owner-approved). Column-order assertion guards a silent reorder.
- Types lag the unapplied migration → rely on the untyped `createServerClient` + hand-casts (existing pattern), optional `dish?` on `PublicRecipe`.
- Dish columns already exist on prod via #298 (`20261017220000_recipe_dish_columns.sql`); the new migration is additive/idempotent and must not conflict.

## Progress notes
See `HANDOFF.md` (resume point) and `NOTIFY.md` (timeline).
