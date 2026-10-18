# Checkpoint 1 — after Step 1.5 (schema + helpers + extraction)

Steps 1.1–1.5 complete. Server/UI steps (1.6–1.8) remain.

## Validation (full gate)
- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 2 warnings (both pre-existing, outside this change: `setFormEmail` unused).
- `pnpm test` — **1071 passed / 86 files**. New: `recipe-dish.test.ts` (33), `dish-versions.test.ts` (21), `run-extract-recipe.test.ts` +5 dish cases.

## What landed
- Migration `20261017230000_recipe_dish_versions.sql` + rehearsal `s21-rehearse-dish-versions.sql` (owner applies via Management API; NOT from CI).
- `recipe-dish.ts`: pure validators + `classifyDish`/`writeVariantNote` (gpt-4.1, never throw).
- `recipe-labeling.ts`: `postChatJson` exported.
- `run-extract-recipe.ts`: vocab RPC ∥ existing query; dish ∥ labelRecipe; note after; insert / own-row gap-fill / refresh writes, all guarded on `dish_classified_at is null`.
- `dish-versions.ts`: ingredient diff, badges, bar/heading wording, sort.

## UI verification
Not applicable yet — no UI rendered until Step 1.6. Deferred to the final gate (behind empty data: no bar/section/RPC).

## Next
Step 1.6 — `dish-versions-bar.tsx`, `dish-versions.tsx`, `dish-versions-sort.tsx`; `RecipeHeader` `versionsBar` slot; `page.tsx` RPC only when `recipe.dish` non-null.
