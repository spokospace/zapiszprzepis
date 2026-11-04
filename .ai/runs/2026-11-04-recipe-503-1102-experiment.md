# Recipe 503/1102: measure CPU, no-cookies route experiment, prefetch

- Date: 2026-11-04
- Branch: `fix/recipe-503-1102-experiment`
- Source doc: `.ai/specs/briefs/2026-11-04-recipe-503-1102-experiment.md`
- Engine: om-auto-create-pr (steps: 8, --loop: no)

## Goal

Stop 503 `error code: 1102` (Worker CPU limit, Workers Free) when recipes are browsed quickly, signed in, on a phone. Stay on the Free plan, no Astro rewrite.

## Scope

1. Measure CPU time and outcome per route with `wrangler tail` while repeating the production probe.
2. Add a temporary, flagged, `noindex` experimental route that renders the guest-safe recipe with no cookies/headers in the render path (ISR), and probe it on production with the same 150-request test.
3. If the measurement shows the neighbour prefetch adds renders, make the Previous/Next prefetch intent-based (touch/hover/focus) instead of full-payload on render.

## Non-goals

No Workers Paid switch, no Astro rewrite, no guest-HTML edge cache, no change to the data cache or storage, no deploy from this machine (master + Workers Builds, then `pnpm smoke:prod`).

## Risks

- The experiment route needs a merge to `master` to be probed on production; it is `noindex` and behind an env flag, and is removed (or left off) after the result.
- Intent-based prefetch changes a #464 UX decision (tap lands on the recipe, not the skeleton); the trade-off is stated in the PR.
- `wrangler tail` may lack token permission; the fallback is the Workers Observability dashboard via Chrome.
- If trivial routes also exceed the limit, parts 2–3 are moot; the result says so plainly.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Measure

- [ ] 1.1 Measure CPU per route with wrangler tail
- [ ] 1.2 Record the numbers in the plan and the PR

### Phase 2: No-cookies route experiment

- [ ] 2.1 Add the flagged noindex experimental recipe route
- [ ] 2.2 Add tests for the route and its flag
- [ ] 2.3 Probe the route on production and record the result

### Phase 3: Neighbour prefetch

- [ ] 3.1 Make the neighbour prefetch intent-based if the data supports it
- [ ] 3.2 Update the prefetch test

### Phase 4: Ship

- [ ] 4.1 Run the validation gate, review, merge and smoke:prod
