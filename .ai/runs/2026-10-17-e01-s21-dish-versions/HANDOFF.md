# HANDOFF — E01-S21 Phase 1

**Resume point:** COMPLETE. All Tasks 1.1–1.8 done + review fixes. PR #301 **ready** (non-draft), reviewed (2 adversarial passes, findings fixed), gate green (1086 tests, typecheck clean, 0 lint errors), UI verified behind empty data. Labels: feature, priority-medium, risk-high, needs-qa, qa-self-verified. Awaiting owner: apply migration (Management API) + merge + Phase 2 (#298 backfill).

**Remaining:** 1.6 UI components (`dish-versions-bar.tsx`, `dish-versions.tsx`, `dish-versions-sort.tsx`), `RecipeHeader` `versionsBar` slot, `page.tsx` RPC-only-when-`recipe.dish`; 1.7 `SimilarRecipes` `dish` prop + `.or()`; 1.8 reflow confirm + final gate. Then labels, review, QA, ready.

**UI build notes:** server client untyped → `supabase.rpc('dish_versions',{p_recipe_id})` then cast rows to `DishVersionRow[]`. Add optional `dish?`/`dish_accusative?`/`variant_note?` to `PublicRecipe` in `load-recipe.ts`. Tokens: `bg-surface-accent` (#fff7ed), `border-border-accent` (#fed7aa), `text-ink`, chip look via `chipClasses()`. Bar = `<a href="#inne-przepisy">`; section heading `<h2 id="inne-przepisy" tabIndex={-1}>`. Sort control = links `?wersje=` + JS island (localStorage `zp.versionsSort`, history.replaceState, live region). Stretched-link card pattern (see `RecipeCard` tile variant). `sourceLabel` for source line. Green `#15803d` / red `#b91c1c` for +jest/−niema.

---
**Original context (still valid):**

**Context already gathered (no need to re-explore):**
- Columns `dish`/`dish_accusative`/`variant_note`/`dish_classified_at` already live on prod via #298 (`supabase/migrations/20261017220000_recipe_dish_columns.sql`). New migration = view append + index + 2 RPCs + grants (idempotent column/check adds for self-containment).
- View `public_recipes` current tail: `… gallery_count, servings, author_gender_form` (assert last two = `servings, author_gender_form`). Full def in `20261017210000_author_gender_form.sql`.
- `stems()` + `resolveDescription` comma-strip technique in `src/lib/recipe-tags.ts`. `postChatJson` (private, `gpt-4.1`, json_object, 30s) in `src/lib/recipe-labeling.ts` → export it.
- `RECIPE_CATEGORIES` labels in `src/lib/recipe-categories.ts` (blocklist source). `parseIngredients` in `src/lib/ingredients.ts`. `formatMinutes` → "1 godz 30 min". `sourceLabel` in `src/lib/recipe-source.ts`. `chipClasses` in `src/app/components/ui/chip.tsx`.
- Extraction `deps.supabase` is an **untyped** `SupabaseClient` → dish writes need no type changes; gap-fill `gapFill` is typed `recipes.Update` so put dish fields in a separate merged object.
- Server client (`createSupabaseServerClient`) is **untyped** → `supabase.rpc('dish_versions', …)` works; hand-cast result. `load-recipe` casts rows to `PublicRecipe` → add optional `dish?`/`dish_accusative?`/`variant_note?` there.
- Recipe page `Promise.all` is in `page.tsx`; add RPC conditionally (`recipe.dish ? supabase.rpc(...) : null`). Bar slot goes in `RecipeHeader` text column bottom.
- Reflow: recipe page already covered in `e2e/reflow.spec.ts`.

**Validation gate:** `pnpm typecheck && pnpm lint && pnpm test`. Skip `/simplify` on `*.test.ts`.
