# Test pure pipeline units — Plan Brief

> Full plan: `context/changes/test-pure-pipeline-units/plan.md`
> Research: `context/changes/test-pure-pipeline-units/research.md`

## What & why

Configure vitest and unit-test the pure functions of the extraction pipeline —
§3 Phase 1 of the test plan. Covers Risk 2 (junk passes the gate), Risk 4
(ingredient mis-parse) and Risk 5 (wrong source/id detection). Cheapest layer
that gives real signal: these functions are pure, deterministic, and need no mocks.

## Starting point

Vitest is installed (`^4.1.8`) but has no config, no `test` script, and no `@/`
alias for tests; the only test is a no-op placeholder. The pure detection/quality/
Firecrawl functions are clean and import-safe, but the Risk-4 grouping logic is
trapped inline in a React Server Component (and crashes on malformed jsonb), and a
divergent dead copy of the whole pipeline lingers in `src/trigger/extract-recipe.ts`.

## Desired end state

`pnpm test` runs a green suite covering every pure pipeline function with
risk-grounded fixtures. Two obvious detection bugs are fixed. Ingredient
parse/group is a tested pure module the detail page consumes (no more crashes). A
tested post-LLM recipe validator exists. The dead twin is gone. The test-plan
cookbook (§6.1) and rollout state (§3 Phase 1) are updated.

## Key decisions made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Risk 4 grouping | Extract pure `parseIngredients`/`groupBySection` to `src/lib/ingredients.ts`, refactor RSC | Only way to unit-test it; helper becomes the de-facto ingredient schema | Plan |
| Behavior policy | Pin current behavior + fix two obvious bugs | Green tests now; real misroutes (`blogspot.de`, `gaming.youtube.com`) gone without a risky multi-path rewrite | Plan |
| Risk 2 output | Add pure `isExtractedRecipeUsable`; wire later | Closes the biggest Risk-2 gap at unit level; pipeline wiring is Phase-2 integration | Plan |
| Dead twin | Delete `extract-recipe.ts` only | It's the divergent risk; `example.ts` is still used by the `test-trigger` route | Plan + Research |
| CI gates | Add `test`/`typecheck` scripts, name gates only | CI YAML is a later module's job (module boundary) | Plan |

## Scope

**In scope:** vitest config + scripts; unit tests for content-quality,
detect-source-type, youtube, blogspot detection, firecrawl, ingredients;
`isBlogspotUrl` country-code fix; youtube subdomain fix; `parseIngredients`/
`groupBySection` extraction + RSC refactor; `isExtractedRecipeUsable`; delete
`extract-recipe.ts`; cookbook + rollout-state update.

**Out of scope:** CI YAML; integration/e2e; wiring the validator into the
pipeline; unit normalization tests; fixing pinned quirks (gate `&&`, GT-≥500,
interleaved sections); full trigger.dev teardown (`example.ts`, demo route, deps).

## Architecture / approach

Infra first, then tests-with-fixes for already-pure modules, then the Risk-4
extraction refactor, then the validator + dead-code removal, then bookkeeping.
Pure tests import sibling modules through the `@/` alias mirrored in
`vitest.config.ts` (node env, no DOM). Every non-fixed behavior is locked with a
characterization test commented as a known limitation.

## Phases at a glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Vitest infrastructure | `vitest.config.ts`, `test`/`typecheck` scripts, green placeholder | Alias/exclude misconfig picks up e2e or worktree tests |
| 2. Pure tests + 2 fixes | Specs for 5 pure modules; blogspot + youtube fixes | A "fix" overreaches into a pinned-quirk rewrite |
| 3. Risk 4 extraction | `ingredients.ts` + RSC refactor + tests | Refactor changes render output (must stay identical) |
| 4. Validator + cleanup | `isExtractedRecipeUsable` + delete dead twin | Deleting the wrong trigger file (example.ts is live) |
| 5. Cookbook + state | test-plan §6.1 + §3 Phase 1 complete | — |

**Prerequisites:** none (research done; vitest already installed).
**Estimated effort:** ~1–2 sessions across 5 small phases.

## Open risks & assumptions

- Assumes `extract-recipe.ts` is truly unreferenced (verified: no `.trigger()`/import).
- The Risk-4 refactor must preserve render output exactly except for the new
  crash-safety on malformed jsonb (a deliberate, safer change).
- Pinned quirks remain as known limitations; fixing them is a separate change.

## Success criteria (summary)

- `pnpm test` green across all pure pipeline functions; `pnpm typecheck`/`pnpm lint` clean.
- `gaming.youtube.com` routes to `youtube`; `blogspot.de` routes to the feed path.
- Recipe detail page renders identically and no longer crashes on malformed ingredients.
