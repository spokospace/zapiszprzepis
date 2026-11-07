# One shared public page, then served without rendering

**Status: approved by the owner on 2026-11-05, Phase 0 in progress.** Replaces the direction of `2026-11-04-shared-recipe-page-client-personalization.md` (branch `exp/astro-pilot`). Evidence: `.ai/runs/2026-11-05-worker-usage-and-static-build.md`. Research: `context/foundation/static-architecture-research-2026-11.md`.

## 📝 TLDR

Readers of recipes, category lists and the home page hit a Next.js render on a Worker with a 10 ms CPU limit, so browsing fails with 503 (error 1102), although 925 recipes change only in rare batches. **Proposed (future behavior):** public pages stop depending on who is reading, personal state moves to the browser, and the shared page is then served without rendering. Phase 1 is needed by every option; how the page is served is settled in Phase 2 by a measured pilot.

## ✅ Decisions (owner, 2026-11-05)

- **Q1. Serving:** improve the existing version first. Phase 0 and Phase 1 run on Next.js; the pilot tries Next.js files first. Astro files are the fallback if Next.js files miss the Phase 2 targets. Workers Cache is out, because it needs Paid in practice.
- **Q5. Workers Paid:** not now. The work stays on the Free plan for as long as it can improve the site. Known limit: static pages do not remove 1102 from screens that stay on the Worker (`/login` 57 ms, `/dodaj`, `/settings`, admin, page misses, possibly `/_next/image`), so Paid stays the fallback for those.
- **Q2. Freshness:** automatic refresh within about 15 minutes. With a file-based option, a build already running can stretch this to about 20 minutes, and a failed build leaves pages stale until the next success, so a kill switch is required. Refresh is capped at 12 builds a day, reset at midnight UTC, which keeps 3,000 build minutes a month within reach at 6-7 minutes a build. Changes after the cap stay in the change table and go out in the first build after the reset, so a backfill day can exceed 15 minutes; a removal that cannot wait uses the kill switch.
- **Q3. Search:** `search_recipes` stays and is called from the browser.
- **Q4. Scope:** one spec with independently shippable phases.
- **Earlier, still valid:** step photos and the gallery stay signed-in perks loaded on the client; owner buttons appear after a client check; the interface must not get worse.

## 📝 Problem Statement

- Over 31 days 15,514 of 195,632 Worker requests (7.9%) ended in `exceededResources`. Median CPU of successful requests has been 10-57 ms since 2026-10-20, against a 10 ms limit. Crons are not the cause (4,275 ms of 656,356 ms in 24 h).
- `/przepis/*`, `/` and `/przepisy/*` used 74.7% of the CPU that could be attributed to a URL. A recipe request averages 86 ms, so tuning the render below 10 ms is not realistic.
- The catalogue is small: 2.42 MB of JSON, all cards 71 KB gzipped, 7 accounts, 16 favorites. On 14 of the last 21 days at most 7 recipes changed; backfills reached 493 in a day.
- Caching behind the Worker did not give a reliable result, and the state after a deploy is unexplained: the version deployed on 2026-11-05 failed 26% of requests in its first hour while `pnpm smoke:prod` passed, because that test never opens a recipe.

## 📝 Proposed Solution

### Options compared

| | Astro files | Next.js files | Workers Cache |
|---|---|---|---|
| How | Astro writes HTML into assets; React components as islands | Next prerenders; a post-build step copies HTML and `.rsc` into assets | Worker renders once; hits are answered before the Worker runs |
| Worker on a page view | None | None | None on a hit; a miss renders (86 ms) |
| Needs Paid | No | No | Yes in practice: misses would still hit 1102 |
| JS and TBT | Measured: 87-109 KB, TBT 60-138 ms | Unchanged from today: 195 KB, TBT 527-1397 ms | Unchanged from today |
| Navigation | Full loads; prefetch only in Chromium, View Transitions | Client navigation likely, relies on undocumented router details and a zone rewrite rule; falls back to full loads | Client navigation unchanged |
| Renderers | Two, unless page bodies are shared | One | One |
| Removal | Rebuild plus kill switch | Rebuild plus kill switch | Immediate, by tag purge |
| Content update | Astro-only build is possible | Full Next build and Worker deploy | No build |
| After a deploy | Files present | Files present | Empty: keyed by Worker version, no pre-warming |
| Evidence on our pages | Pilot: 925 pages in 3 min 16 s | None; one outside project (policai) | None; untested with OpenNext |

### Rejected

- **Cache Rules at the zone:** the request reaches the Worker before the cache, and cookie keys are Enterprise-only.
- **PPR and Cache Components:** the shell still comes from the Worker on OpenNext.
- **vinext:** page assets are read through the Worker, and it is beta.
- **`output: 'export'` as a second build:** two builds, with full loads between them.
- **React Router, TanStack Start:** a full rewrite (33 pages, 14 routes, 25 action files) that still hydrates whole pages. Cloudflare's docs list prerendering as unsupported with the React Router plugin; that page may be out of date.
- **All of the app on Astro:** the same rewrite; only worth revisiting if a dynamic Astro page measures under 10 ms.

### Prior art

Forem is the closest match: the same cached HTML for everyone, with user data from a separate call. Mealie and Tandoor are SPAs, and static recipe sites have no personal state, so no mature recipe project shows this exact pattern.

## 📝 Architecture

**Shared page (Phase 1, every option).** Everything a page reads per request moves out:

| Today | Moves to |
|---|---|
| Session, header, member or guest home | Browser session store, shared across islands if Astro wins |
| 7 recipe `searchParams`, toasts, `from`, category `tag`/`strona`, home `tab`/`fav_added` | `location.search`, client filtering |
| Hearts, owner buttons, gallery, step photos, locked teaser, version favorites | Client overlay with reserved space |
| Similar recipes | Build or cache time, no cookie client |
| Recipe of the day | Client pick from the static pool, or a daily rebuild |
| add/removeFavorite, getSuggestions, sign-out | Browser Supabase; RLS already allows these |
| `refreshRecipe` | New API route (needs `EXTRACTION_LIMIT`, Inngest, access check) |
| Merged slugs, hidden "unavailable", staff banner | Stay on the Worker; reached when no public page exists |

**Personal lists.** `/ulubione` and `/recipes` become a static shell plus static cards filtered by ids from Supabase. Rows missing from the cards are fetched from Supabase, which covers recipes newer than the build; a row that is still missing shows as "unavailable". Cards gain `tags` and `extra_categories`. `/u/{username}` stays on the Worker: it needs a real 404 and metadata.

**Files (only if Q1 picks files).**
- Output `przepis/{slug}.html`, so the URL stays `/przepis/{slug}`. A slug without a file falls through to the Next.js route, so new recipes work at once.
- Pointer file `data/tiles.json` with `Cache-Control` revalidation, so open tabs never request a removed hash.
- Files are read in one bulk query, with external CSS. At 0.21 s per page, 5,000 recipes would pass the 20-minute build timeout.
- `_headers` is generated from `securityHeaders()`. HTTP to HTTPS moves to the zone, because `custom-worker.ts` no longer runs on these URLs.
- A separate assets Worker on routes, with a service binding to the app for misses, would keep content builds away from the app. This fits Astro only and is untested, so the pilot checks it.
- Refresh: triggers fill a change table (`updated_at` cannot show hard deletes), the cron calls a Deploy Hook at most once per 10 minutes, up to the daily cap in Q2, a watermark advances only after a successful smoke test, and each build bumps the service worker version.
- Kill switch: a zone redirect rule for one URL, used for legal removal, described in `docs/recipe-files.md`. Tested live on 2026-11-06: the rule beats the static file.

**One source of truth.** If two renderers exist: a pure `buildRecipeView(recipe)`, shared `RecipePageBody`, `HomeBody` and `CategoryBody`, `headTags(metadata)`, `recipe-split.ts`, and a parity test comparing Next.js and static output.

## 📝 Data Model

- New `recipe_changes` table fed by triggers on insert, update and delete of `recipes`, and on update of `profiles.display_name`, which records that author's recipe ids, because recipe pages show the author's name. File-based options only.
- `step_images` is readable by anon through `public_recipes`; only `visibleStepImages` hides it in the UI. This exists today. A separate view or RPC under RLS keeps the URLs out of public data, but it is not enough alone: the `recipe-images` bucket is public, so a URL a guest already has keeps working. Enforcing the perk needs a private bucket or signed URLs for step photos, and a migration of the existing objects.

## 📝 Edge Cases & Failure Scenarios

| Case | What the reader sees |
|---|---|
| Supabase down | Guests keep pages; search and hearts show a retry. The header comes from the local session |
| Worker in bad state | Pages load; `/_next/image` photos may fail until image delivery is decided |
| Failed rebuild | Pages stay on the last good version; the watermark does not move and the failure is logged |
| Open Next tab after a file appears | POST to an asset path returns 405, so no public page may depend on a Server Action |
| Browser and middleware refresh the token at once | Must be tested with an expired token: `createSupabaseBrowserClient` has no callers today, and rotation has a 10 s reuse interval |
| Signed-in reader, full page load | Reserved slots, a CLS test, and an inline script applying `--text-scale` before paint |

## 📝 Risks & Impact Review

- **Image delivery is undecided.** Every photo goes through `/_next/image` on the Worker, and direct Supabase images risk the 5 GB egress limit. Phase 2 must decide; without it, "no Worker" holds for text only.
- **Search from the browser** has no app rate limit and sends guest IPs to Supabase, so the privacy policy needs a check.
- **Rollback:** Phases 1 and 2 keep the Next.js routes. Removing a file or disabling the cache brings the old path back.
- **`BACKWARD_COMPATIBILITY.md`:** the Worker configuration section applies to new bindings and cron work.

## 📋 Phasing

- **Phase 0, now:** cheap fixes to the existing version: `public/_headers` for `/_next/static`, `smoke:prod` opens recipes, `SimilarRecipes` reads through the cache, imports invalidate per recipe.
- **Phase 1, shared page:** session store, overlay, browser favorites and search. Ships on Next.js and already removes the session work. Skeleton changes go in the same PRs.
- **Phase 2, pilot:** 20 recipes as Next.js files on a preview. Astro files only if the targets are missed; then the owner picks.
- **Phase 3, roll out:** recipe pages, then categories and home.
- **Phase 4, personal lists:** `/ulubione`, `/recipes`.

## 📋 Implementation Plan

### Phase 0
1. Add `public/_headers` with one year `immutable` for `/_next/static/*`; verify on a preview.
2. Extend `smoke:prod` with sampled recipe URLs and a failure threshold; unit test the threshold.
2a. Read `SimilarRecipes` through `recipe-cache.ts` with the anon client, so its queries stop running on every view; hearts keep the signed-in read.
2b. Look up the slugs of the recipes a run wrote from their ids (the extraction result carries ids only), pass them to `revalidateRecipeCaches`, and only then take `recipes:list` off the recipe read, in the same PR, so one import stops purging every recipe and no written page stays stale.

### Phase 1
3. Add the browser session store with a test for sign-out and user change; verify token refresh with an expired token.
4. Move the header, menu counters and notifications to the store.
5. Move favorites and suggestions to browser Supabase; check RLS with both QA accounts.
6. Add `/api/recipes/refresh`, replacing the Server Action.
7. Gate `step_images` under RLS, then load photos and gallery in the overlay. Moving step photos to a private bucket or signed URLs is a separate step, decided by the owner, since it changes image delivery and cost.
8. Move toasts, `from` and `searchParams` to the client, with `loading.tsx` updated in the same PR.
9. Remove `cookies()`, session and `searchParams` from the three public routes; `next build` shows them as static.

### Phase 2
10. Build the Next.js files candidate for 20 recipes, including the `.rsc` rewrite rule.
11. Measure it: Worker invocations per view, 100 different recipes in sequence with at most 1% failures, TBT and LCP at 4x throttle on the phone, navigation time, build time, photos.
12. If it misses the targets, finish the Astro candidate for the same recipes, with shared bodies, and measure it the same way.
13. The owner picks from the numbers.

**Result (2026-11-06):** the owner chose Next.js files. Phone at 4x CPU and slow 4G, same recipes: LCP 1660 ms against 2156 ms on the Worker, TBT 191 ms against 243 ms, CLS 0. HTML median 0.09 s against 0.96 s, with no Worker. Not proven: resilience to 503, since Worker recipes also passed every test run at night.

### Phase 3
14. Export at scale: 8 pages in parallel, a 10-minute limit, a page counts only with its `Recipe` structured data (the status is sent before the render), and `.next/cache/fetch-cache` is removed, because OpenNext would upload it to R2 on every deploy.
15. Refresh, simpler than the change table above: triggers move one `content_version` number, the build saves the number it read in `recipe-files-version.json`, and the five-minute cron calls the deploy hook when the deployed number is behind, at most once per 10 minutes and 12 times a day. A failed build needs no watermark: the deployed number stays behind.
16. Owner: apply the migration, create the deploy hook, save it as the `RECIPE_FILES_DEPLOY_HOOK` secret.
17. Set `scripts/recipe-files.json` to `"all"`.
18. Done on 2026-11-06/07: HTTP to HTTPS at the zone (Always Use HTTPS), a post-deploy check on the cron (#731), home as a file (#732). Image delivery: the owner kept `/_next/image` on the Worker (2026-11-07; numbers in `docs/wyniki-testow.md`). Still open: the `.rsc` rewrite rule and categories (they read `?tag` and `?strona` on the server, so they need client filtering first).
19. `/szukaj` as a file: a static page reads the address and searches in the browser, and `export-recipe-files.mjs` saves it as `public/szukaj.html`. One query per search; „Pokaż kolejne” and „Kategoria” narrow the same rows.

### Phase 4
20. Detailed after Phase 3.
