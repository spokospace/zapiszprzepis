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

## Measurements (2026-11-04)

`wrangler tail` is not available: the project token gets "No access to the specified resource" on `/workers/scripts/zapiszprzepis/tails`. Read from the Cloudflare dashboard instead (Workers → zapiszprzepis → Metrics, last 24 h, all versions):

- Invocations 8.63k, errors 534, of which **533 "Exceeded CPU Time Limits"** (1 memory). So practically every error is the CPU limit.
- CPU time of the active deployment: **median 12.89 ms** (limit on Free: 10 ms), error rate 31.9% during the probe window.
- Subrequests: 16.3k to Supabase (avg 62.7 ms); network waits do not count as CPU.
- Not obtained: a per-route CPU split. The Observability query builder exposes `$workers.cpuTimeMs`, but grouping by request path returned no events in the time available.

Prefetch share (Observability, last 24 h, events with the `next-router-prefetch: 1` header): **4,480 of about 8.6k invocations (~52%)**. The most frequent prefetched URLs are `/?_rsc`, `/szukaj?_rsc` and `/przepisy/{zupy,ciasta,obiady}?_rsc` (about 55–85 each), i.e. the always-visible header links and the category links, not only the recipe Previous/Next buttons. `/`, `/szukaj` and `/przepisy/*` have no `loading.tsx`, so these prefetches cache nothing useful.

Reading: the typical request through the Worker already costs about as much CPU as the Free limit allows, so the limit is hit by ordinary traffic, not only by cold starts. Cutting the number of renders (cache hits, no prefetch renders) matters more than trimming one page's render.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Measure

- [x] 1.1 Measure CPU per route with wrangler tail (tail denied; read from the dashboard instead, no per-route split)
- [x] 1.2 Record the numbers in the plan and the PR

### Phase 2: No-cookies route experiment

- [x] 2.1 Add the flagged noindex experimental recipe route (`● /lab/przepis/[slug]` in `next build`)
- [x] 2.2 Add tests for the route and its flag
- [ ] 2.3 Probe the route on production and record the result (after the merge deploys)

### Phase 3: Prefetch

- [x] 3.1 Stop prefetching the always-visible header and category links (about half of all invocations were prefetches); the neighbour Previous/Next prefetch is left as is for now
- [x] 3.2 Add a test that guards those links

### Phase 4: Ship

- [ ] 4.1 Run the validation gate, review, merge and smoke:prod
