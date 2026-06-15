<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test pure pipeline units

- **Plan**: context/changes/test-pure-pipeline-units/plan.md
- **Scope**: All 5 phases (full plan)
- **Date**: 2026-06-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria re-run at review time: `pnpm test` → 46 passed / 7 files;
`pnpm typecheck` → clean; `pnpm lint` → 0 errors. All phase Progress items `[x]`
and SHA-stamped.

## Findings

### F1 — `steps` parse in detail page still crashes on malformed jsonb

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/(authenticated)/recipes/[slug]/page.tsx:78-80
- **Detail**: Phase 3 made ingredients crash-safe via `parseIngredients`, but the sibling `steps = ... JSON.parse(typedRecipe.steps as string)` was left raw — the same crash class the ingredient fix removed. Explicitly out of scope for this change (ingredients only), so a correctly-deferred sibling, not a defect.
- **Fix**: In a follow-up, add a `parseSteps` (or generalize `parseIngredients` into a tolerant `parseJsonArray`) and use it for steps too.
- **Decision**: DEFERRED — out-of-scope follow-up

### F2 — `env.test.ts` is a tautological smoke test

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/env.test.ts:5-7
- **Detail**: The placeholder asserts `expect(true).toBe(true)` and re-implements a requireEnv-like check inline instead of importing `env.ts`. Pre-dates this change (Phase 1 only fixed its types to unblock the typecheck gate), so not a regression — but it's the one weak file in an otherwise strong suite and slightly contradicts the §6.1 "real assertions" convention this change established.
- **Fix**: Either delete it, or replace with a real test that imports `env.ts` behind a mocked `process.env` (follow-up).
- **Decision**: DEFERRED — out-of-scope follow-up

## Notes

Full MATCH across all 5 phases — no drift, no missing items, no unplanned scope.
The new regexes (`isBlogspotUrl`, youtube host detection) were specifically
probed for ReDoS and bypass and are correctly defended with negative tests
(`foo.blogspot.com.evil.com`, `evil-youtube.com`, `youtube.com.evil.com`).
`parseIngredients` provably never throws across all input types. Both observations
are deliberate out-of-scope follow-ups, not defects in the delivered work.
