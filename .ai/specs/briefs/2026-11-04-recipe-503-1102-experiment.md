# Stop 503 (Cloudflare 1102) when browsing recipes: measure CPU, run a no-cookies route experiment, cut prefetch renders

- Date: 2026-11-04
- Category: bug
- Priority signal: high — the owner hits 503 on their phone while signed in and browsing quickly; they call it unacceptable for plain page viewing
- Risk signal: medium — touches the recipe page's prefetch behaviour (#464/#516 UX decision) and adds a temporary public route on production
- Routing: Next: om-auto-create-pr "Recipe 503/1102: measure CPU per route, run a no-cookies ISR route experiment, drop full neighbour prefetch if the data supports it — brief: .ai/specs/briefs/2026-11-04-recipe-503-1102-experiment.md"

## Problem

Browsing recipes quickly returns 503 with body `error code: 1102` (Worker exceeded its CPU limit; Workers Free plan = 10 ms CPU per request). Production probe on 2026-11-04, guest, 150 random cold recipe URLs from the sitemap at ~3 requests/s: 69 returned 503/1102, 0 other errors; failure rate per block of 25 requests was 12%, 12%, 48%, 36%, 84%, 84%. A second, slower probe (~1 request/s, interleaved) hit 2/40 on recipes, 6/40 on the home page and 3/40 on `/polityka-prywatnosci`, so simple pages fail too and the rate depends on request rate. The owner reproduces it signed in, on a phone, going from recipe to recipe.

Facts established:
- Recipe HTML is served `Cache-Control: private, no-cache, no-store`; the page reads cookies (`createSupabaseServerClient`, `src/app/przepis/[slug]/page.tsx:86`) and `src/middleware.ts` runs `updateSession` on every request, so every visit is a full React SSR.
- The OpenNext R2 + D1 data cache (PR #636, `unstable_cache` 120 s) is on. It saves database queries, not render CPU.
- Two guest GETs of the same recipe were byte-identical (187,851 bytes, no Set-Cookie, no CSP nonce).
- `recipe-list-bar.tsx:153` prefetches the FULL neighbour payload (`prefetch`, #464 item 3 / #516), so each recipe view can trigger two extra dynamic renders. Not proven to be the main multiplier: the guest probe had no prefetch and still failed.
- `custom-worker.ts` already wraps the OpenNext handler and has a Workers Cache API layer for `/_next/image` (`src/lib/image-cache.ts`).
- Cloudflare facts (docs): Free = 10 ms CPU per request; Paid = $5/month, 30 s default CPU limit. Network waits do not count as CPU.
- Per-request CPU has NOT been measured. It is unknown whether the cost is render CPU or cold-start/module-init CPU (the Worker is ~10.9 MiB raw).

## Agreed direction

Owner decisions (this session): stay on the Free plan for now (no Workers Paid), fix it in code; do not rewrite to Astro. The owner's design intent: signed-in and signed-out recipe pages barely differ (only favorites, settings and the add-recipe flow), so the public recipe page could be the same for everyone, with the few personal bits loaded separately.

One PR, three parts, in this order:
1. **Measure.** Run `pnpm exec wrangler whoami` first (project rule), then `wrangler tail` (or Workers Observability if the token cannot) while repeating the probe, and record CPU time and outcome (`exceededCpu`) per route: a recipe, `/`, `/polityka-prywatnosci`, a static asset. Post the numbers in the PR. If trivial routes also exceed the limit, render-reduction work is moot, say so plainly and stop there.
2. **No-cookies route experiment.** Add a temporary experimental route (e.g. `/lab/przepis/[slug]`, `noindex`, behind an env flag, no cookies/headers in the render path, `generateStaticParams` + `revalidate`/tag) that renders the guest-safe recipe. Probe it on production with the same 150-request test (sequential, ~3/s, random sitemap slugs) and compare 503 rate and TTFB with `/przepis/[slug]`. Question it answers: does a route that needs no per-request render survive the same load on OpenNext + Free? Remove the route (or keep it flagged off) once the result is posted.
3. **Cut the render multiplier.** If part 1 shows the neighbour prefetch adds renders, switch the Previous/Next prefetch from "full payload when the button renders" to intent-based (touchstart/pointerdown or hover/focus). State the trade-off: #464 chose full prefetch so a tap lands on the recipe, not on the skeleton. Keep `recipe-list-bar.prefetch.test.ts` updated, and keep `loading.tsx` layout parity (project rule).

Rejected / deferred:
- Build nothing: rejected, 46% of cold requests fail in the probe and the owner calls it unacceptable.
- Workers Paid ($5/month): not chosen by the owner for now; remains the lowest-effort fix and the fallback if parts 1–2 show the Free limit cannot be met.
- Rewrite to Astro (all or only public pages): rejected for now. About 35k lines, 47 routes, auth, admin, Inngest, MCP, and recipes are added continuously (a static build would need a rebuild per change or on-demand SSR again, which brings back the CPU limit).
- Guest-HTML edge cache in `custom-worker.ts` (Cache API keyed by URL when there is no `sb-*` auth cookie): deferred. It does not help the signed-in owner, and the Cache API ignores `Vary`, so the key must include RSC/`Next-Router-*` headers or RSC could be served for HTML requests.
- A full spec for ISR recipe pages with client-side personalization: only after part 2 gives a result.

## Resolved unknowns

| Question | Answer (from the conversation) |
|----------|--------------------------------|
| Is Workers Paid an option? | Owner chose "no Paid, code only" for now. |
| Signed in or guest when it happens? | Signed in, on a phone, going quickly between recipes. |
| Rewrite to Astro? | Owner raised it; recommendation and reviewer verdict: not now. |
| Where does the CPU go? | Unknown. Part 1 measures it. |
| Does neighbour prefetch multiply renders? | Plausible, unproven. The guest probe had no prefetch and still failed. |
| Can the owner's signed-in case be reproduced? | Not yet. Repeat the probe with the dev QA login (`/api/dev/login?as=free`, read-only pages only; never add recipes as a QA account). |

## Non-goals

- No switch to Workers Paid, no Astro rewrite, no change to image handling.
- No guest-HTML edge cache in this change.
- No change to the data cache (Phase 2) or to how recipes are stored.
- No deploy from this machine: ship through master and Workers Builds, then `pnpm smoke:prod`.

## Affected areas (if known)

- `src/app/przepis/[slug]/page.tsx`, `layout.tsx`, `loading.tsx`, `_components/recipe-list-bar.tsx` and `recipe-list-bar.prefetch.test.ts`
- `src/middleware.ts`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/server.ts`
- `custom-worker.ts`, `open-next.config.ts`, `wrangler.jsonc`
- Evidence: `.ai/specs/2026-10-26-cache-guest-reads-phase2-plan.md`, issues #464 and #545
- Protected surface: BACKWARD_COMPATIBILITY §6 (Worker configuration)
