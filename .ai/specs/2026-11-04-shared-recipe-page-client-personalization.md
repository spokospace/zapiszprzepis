# One recipe page for everyone, personalized on the client

**Status: draft.** Spec A (the proof) is partly answered; the items under "Still to prove" gate spec C. Evidence: `.ai/runs/2026-11-04-recipe-503-1102-experiment.md`, comments on #701, #703, #704, #706, `src/lib/html-cache.ts`.

## 📝 TLDR

Moving quickly between recipes can fail with Cloudflare error 1102, because rendering in Next.js can exceed the 10 ms CPU limit of the Workers Free plan. A signed-in reader clicking through recipes reaches Next.js on every step. **Proposed (future behavior):** `/przepis/{slug}` becomes one page for everyone, pre-rendered at build time and answered from OpenNext's incremental cache before Next.js starts, invalidated per recipe by tag. Navigation stays on `<Link>`, and everything personal loads in the browser from Supabase under RLS.

## ✅ Decisions (owner, 2026-11-05)

- **Q10.** Three stages in order: (A) proof, (B) session store and overlay, (C) static route and shared cache.
- **Q11.** `BACKWARD_COMPATIBILITY.md` §8 is amended: a hidden recipe answers `404` with the client "unavailable" view for owners and favoriters; staff get an admin preview route.
- **Q12.** A prefetch that misses the cache must not run Next.js; the tapped link shows a client pending state, as #699 does in the menu.
- **Q13.** Success: at most 1% failures over 100 different recipes clicked in sequence, repeated once. What decides is the combined rate, miss failure rate x how often a request misses. Stop if it is not better than `/przepis` today, in the same direction over at least 2-3 runs, each route in its own batch.
- Earlier: step photos and the gallery stay signed-in perks, loaded on the client; owner buttons stay on the page after a client check; Workers Free stays; no Astro rewrite; the interface must not get worse.

## 📝 Problem Statement

- 533 of 8.63k invocations (about 6%) ended in 1102 over 24 h, median 12.9 ms CPU. Bursts of different pages are far worse, and results vary widely between runs. The owner hits this signed in, on a phone. Cloudflare's own guidance puts server rendering at 10-20 ms, so a render on this plan is inherently at the limit.
- A bad state can last minutes and affect every render of one Worker version, while static files and cached pages still answer. Its cause is unknown.
- Prefetches were about half of all invocations. One view of a simple page still fires over ten RSC requests (`/login`, `/regulamin`, `/polityka-prywatnosci`, `/usuwanie-danych`, `/`, `/szukaj`, `/przepisy/*`, `/u/*`), and some of them answer 503.

## 📝 Spec A findings

| Finding | Evidence |
|---|---|
| Pre-rendered pages answered before Next.js survive a burst | Production, 2 x 150 unvisited recipes, 300 of 300 `200` and `x-opennext-cache: HIT`, p50 0.9 s |
| RSC payloads hit the same cache | 4 of 4 `HIT` in 42-111 ms from a foreign source page |
| **That result lasts only until the page goes stale** | About 7 h later the same pages answered `x-nextjs-cache: STALE` with `s-maxage=2` and no `x-opennext-cache`. On stale, OpenNext calls the queue; our dummy queue throws, so the request falls through to Next.js. Pages never refresh and each visit runs the Worker's Next path |
| Build-time population works | `opennextjs-cloudflare deploy` populated 1855 entries (about 1 min 13 s). Preview builds use `wrangler versions upload` and populate nothing |
| A static route gains nothing on a miss | 43% vs 46% failures alternating; a miss still runs Next.js |
| `<Link>` works on the real tree | Preview and production: no full reload, right recipe, including from a second source page. One extension error, none from the app |
| A runtime flag breaks pre-rendering | `RECIPE_LAB` was unset at build, so every page was stored as `404` (#706). The page tags are present in the entry: `recipes:list`, `recipe:{slug}` |
| `_rsc` is verified on production | Made-up value answered `307`; `validateRSCRequestHeaders` defaults to on |

### After `revalidate = false` (#707, 2026-11-05, 09:40 UTC, over an hour after the build)

| Batch, different unvisited recipes | 200 | 503 | State of the 200s |
|---|---|---|---|
| 150 | 98 | 52 | all `HIT`, p50 1.29 s |
| 150 others | 107 | 43 | all `HIT`, p50 1.05 s |
| One recipe repeated, 20 requests | 20 | 0 | all `HIT`, avg 0.25 s |

- `revalidate = false` worked: pages stayed `HIT` past one hour.
- **32% of requests to different recipes still failed, from the first batch of 50.** This contradicts the 300 of 300 taken at 00:46 UTC with the same kind of test. Failed responses carry no cache header, so which path they took is not known, and the 503 bodies of these batches were not captured.
- A repeated recipe did not fail, which fits a cold R2 read being the expensive part, but that is unproven. Time of day (real traffic) is also uncontrolled.
- `/przepis` was not measured at the same time, so Q13 has no same-moment baseline. 32% is within its earlier range of 5-56%, and far from the 1% target. **The target is not met.**

### Still to prove

1. **`revalidate = false`** on the page and its reads: OpenNext treats such a page as never time-stale, so interception should keep answering. Must be re-measured after more than an hour.
2. **Tag invalidation:** a write purges one pre-rendered page and the next visit re-renders it. `recipes:list` must come off the recipe read, or every import purges every recipe.
3. **A new recipe** (a real miss) and the merged-slug redirect.
4. **Prefetch:** in the browser the prefetches of `/lab/przepis/*` showed `503`, while the same URL with `Next-Router-Prefetch` answered `204` to both `curl` and a page `fetch`. So the real prefetch request differs in a way not yet understood.
5. **Document speed:** repeats of one page fell from 1.2 s to 0.15 s, which suggests a cold R2 read then the regional cache. This was measured while stale, so it needs repeating.
6. **R2 writes per deploy** against the free limit.

## 📝 Proposed Solution

1. **One page:** `/przepis/{slug}` reads no cookies, headers, `searchParams` or session. `export const dynamic = 'error'` makes a stray read fail the build (verify against this Next version).
2. **Pre-render at build:** `generateStaticParams` lists every recipe, `revalidate = false`, `enableCacheInterception` on. Render cost moves to the build, outside the CPU limit, and a deploy no longer starts with an empty cache.
3. **Invalidate by tag:** `revalidateTag(recipeTag(slug))` through the existing D1 tag cache. New recipes render on first visit.
4. **Client personalization:** a session store reads from Supabase under RLS, so personal data never touches the Worker.
5. **Fewer prefetches:** `prefetch={false}` on links to dynamic targets: footer legal links, `/login`, `/u/*`, recipe category links. Cheap, independent, can ship now.

The #704 Cache API layer stays for `/` and category lists until their own spec. For `/przepis/{slug}`, whether it adds anything over interception is decided by measurement.

### Alternatives considered

| Option | Why not |
|---|---|
| Custom D1 invalidation table, own keys, `warm:prod` | Built-in interception, tag cache and `populateCache` do the same. Replaced. |
| Durable Object queue for time-based revalidation | Unneeded if pages never go time-stale. Fallback if `revalidate = false` fails. |
| Plain links with browser prefetch | Worse interface: reloads about 180 KB per step instead of about 45 KB. |
| Workers Paid ($5/month) | Removes 1102 with no code; not chosen. Fallback. |
| Astro or the Pages Router for public pages | A rewrite with no numbers behind it. Fallback if Q13 fails. |
| A separate thin Worker | Interception and the existing bundle survived the burst. |

## 📝 Architecture

- **Session store:** user id, `has_full_access`, counts, notifications summary, favorite ids. This is private data, so it is keyed by user id, never painted until the id matches the current session, cleared in `SignOutForm.onSubmit` next to `clearPrivateCaches` and on any null session. Sign-out is a Server Action, so no browser auth event can be relied on; the same holds for `/api/dev/login` and the global sign-out in `reset-password/actions.ts`.
- **Store freshness:** reloaded after each favorite or notification action, on focus and on a timer, because the header no longer re-renders after `revalidatePath('/', 'layout')`. Lists and recipe pages read favorites from this one source.
- **Token refresh:** `createSupabaseBrowserClient` has no callers today. It would refresh beside middleware on other routes; spec B tests that race with an expired token.
- **Security headers:** `src/middleware.ts` is their only source. Before middleware is skipped they move to the Worker or `next.config` `headers()`, tested on a real response, cached ones included.
- **Middleware:** exclude `/przepis/{slug}` by regex, keeping `.md`. OpenNext ignores `has`/`missing`, so Server Actions skip it too and refresh the session through `createSupabaseServerClient.setAll`; verify with an expired token.

## 📝 Data Model

No schema change. Spec C passes slugs from the extraction result to `revalidateRecipeCaches` instead of calling it bare, and takes `recipes:list` off the recipe read.

## 📝 API Contracts

No new HTTP endpoint. Client reads:

| Data | Read | Protection |
|---|---|---|
| Favorites | `favorites` | owner-only RLS |
| Own recipe | `recipes` by slug | owner RLS |
| Gallery | `recipe_gallery_images` | granted to `authenticated` only |
| Step photos | `public_recipes.step_images` | none: public view, UI-only perk, as today |
| Full access | `has_full_access()` | RPC |
| Notifications | `recipe_shares`, `favorites`, `public_recipes` (`getFailedShares` is `server-only`; needs a client version) | RLS |
| Hidden recipe | `recipe_hidden_for_viewer()`, `has_permission()` | RPC |

## 📝 UI/UX

Nothing moves. Each late block has its own rule, because sign-in state is unknown at first paint: a heart keeps its size; step photos and the gallery row must not leave a blank gap for guests nor jump for signed-in readers. Spec B defines this per block and adds a signed-in layout test, as `e2e/recipe-skeleton.spec.ts` is guest-only and runs without the Worker. Accessible names stay; late content does not steal focus.

## 📝 Edge Cases & Failure Scenarios

| Case | Behaviour |
|---|---|
| New recipe | Renders on first visit and may end in 1102 once; to be measured. |
| Recipe edited or hidden | Tag invalidation; the next visit re-renders. |
| Owner refreshed a recipe | Extraction is asynchronous; the page updates when the job invalidates by slug. Spec C defines what the owner sees meanwhile. |
| Supabase unreachable | The recipe stays readable, personal elements neutral. |
| D1 unreachable | OpenNext serves the entry without the tag check, per the Phase 2 plan; verify under interception. |
| Build cannot list recipes | Nothing is pre-rendered, yet the build is green; `smoke:prod` must check a first-visit `HIT`. |

## 📝 Risks & Impact Review

- **Personal data in shared HTML:** guard with `dynamic = 'error'`, a source test and a parity test through the Worker.
- **Silent loss of the cache:** the stale fall-through was invisible to `smoke:prod`. It needs a check of `x-opennext-cache`.
- **Build cost:** every deploy renders all recipes and reads the production database; about 1855 R2 writes, near the free 1M a month at 17 deploys a day (estimate).
- **Forged router headers on a miss:** spec C confirms a single entry cannot be poisoned.
- **Protected surfaces:** BACKWARD_COMPATIBILITY §1, §3, §6, §8.

## 📋 Phasing

- **Spec A remainder:** the "Still to prove" list on `/lab`.
- **Prefetch reduction:** independent, can ship at any time.
- **Spec B:** session store and overlay, still server-rendered.
- **Spec C:** static `/przepis`, then remove `/lab`.

## 📋 Implementation Plan

### Spec A remainder

1. Set `revalidate = false` on `/lab` and its long-lived read; deploy; confirm `HIT` more than an hour after the build.
2. Trigger one tag invalidation through a real admin or owner action, with the owner, and confirm one page re-renders.
3. Explain the browser prefetch `503`.
4. Repeat the burst on `/lab` after an hour, in its own batch, 2-3 runs.
5. Decide against Q13.

### Prefetch reduction

1. Add `prefetch={false}` to the links named above; extend `no-viewport-prefetch.test.ts`.

### Spec B

Detailed after spec A: store with the rules above; client notification reads; header; overlay blocks with `loading.tsx` in the same PR.

### Spec C

Detailed after spec B. Must include `[slug]/layout.tsx`, `SimilarRecipes` (cookie client), `getSiteUrl`, security headers, the middleware regex, per-slug invalidation, the §8 change, and removal of `/lab`.
