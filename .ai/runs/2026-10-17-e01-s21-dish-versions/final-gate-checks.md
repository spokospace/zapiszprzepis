# Final gate — E01-S21 Phase 1

All Tasks (1.1–1.8) done.

## Validation gate (`pnpm typecheck && pnpm lint && pnpm test`)
- `pnpm typecheck` — **clean**.
- `pnpm lint` — **0 errors**, 2 warnings (both pre-existing, outside this change: `setFormEmail` unused in an unrelated form).
- `pnpm test` — **1083 passed / 87 files**. New suites: `recipe-dish.test.ts` (33), `dish-versions.test.ts` (22 incl. `dishExclusionFilter`), `dish-versions.test.ts` component (11), `run-extract-recipe.test.ts` (+5 dish cases).

## Integration / e2e
`test:reflow` and `test:e2e` need a running dev server + the dev QA login; the recipe page is already in the reflow list and its empty-data shell is covered. The versions UI cannot render against empty prod data (Phase 1), so no new reflow fixture is added — full-section screenshots with versions are Phase 2 (#298), per the spec.

## UI verification (behind empty data) — browser, localhost:3005
Recipe `/przepis/szarlotka-3` (dish null on prod):
- No "Mamy jeszcze N inne przepisy" bar (header renders author line → favorites button directly).
- No "Inne przepisy na …" section.
- **No `dish_versions` RPC call** (network: 0 matches).
- **No console errors**.
- "Podobne: kruche ciasta" renders exactly as before.
Screenshot delivered to the user and described on the PR.

## Design-system / tokens
Tokens only: `bg-surface-accent` (#fff7ed), `border-border-accent` (#fed7aa), `bg-surface-3`, `text-ink`/`text-ink-soft`, `text-action-text` (#9a3412, ≥7:1), `text-danger` (#b91c1c), chip look via `chipClasses()`. Green "+ jest" uses #15803d (5.0:1, no token). No raw #f97316/#ea580c. WCAG targets: bar 60px, chips/cards ≥48px, global focus ring.
