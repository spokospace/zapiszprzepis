# Serving public pages on the Workers Free plan: research, November 2026

Why browsing recipes fails with 503 (error 1102), what was measured, and which ways of serving public pages were checked. Numbers: `.ai/runs/2026-11-05-worker-usage-and-static-build.md`. Plan: `.ai/specs/2026-11-05-static-first-public-site.md`. Earlier experiment: `.ai/runs/2026-11-04-recipe-503-1102-experiment.md`, branch `exp/astro-pilot`.

Owner direction (2026-11-05): keep improving the existing version on the free Cloudflare plan first. Workers Paid and a framework change are fallbacks.

## Conclusions

1. **The cause is the design, not code quality.** A site that is almost entirely read-only content renders every public page per request, with the session in the layout, on a plan with a 10 ms CPU limit. A recipe request averages 86 ms, so tuning the render will not reach 10 ms.
2. **One step is common to every option:** public pages must stop depending on who is reading, and personal state must move to the browser.
3. **Static files are the only option that keeps the Worker out of every public page view on Free.** ISR with cache interception and the Cache API layer still run the Worker; interception failed 32% of requests in bursts. Workers Cache hits skip the Worker too, but its misses render, so 1102 stays on Free.
4. **Static pages do not fix screens that stay on the Worker** (`/login`, `/dodaj`, settings, admin, page misses, possibly `/_next/image`). Paid removes the CPU-limit failures there: its limit is 30 s by default, up to 5 minutes. The 128 MB memory limit stays on both plans and also returns 1102.
5. **Paid does not make pages faster.** It raises the CPU limit; the render stays the same.

## What is badly designed today

| Today | Good practice | Effect here |
|---|---|---|
| `AppShell` reads the session in layouts; pages read `cookies()` and `searchParams` | Session reads only in small leaf parts | Every public page is dynamic with `no-store` |
| No `generateStaticParams` | Pre-rendered pages, dynamic only where needed | The Worker renders content that rarely changes |
| `SimilarRecipes` uses the cookie client and 3 uncached queries, a fourth when signed in | Shared data read once, from cache | Queries run on every view, even when the recipe itself is cached |
| Every read carries `recipes:list`; Inngest purges without a slug | Invalidate only what changed | One import purges the cache of all recipes |
| Data TTL 120 s | Long cache plus invalidation on change | Cache expires although recipes rarely change |
| `/_next/static` sent as `max-age=0, must-revalidate` | Hashed files one year `immutable` | Browsers revalidate files that cannot change |
| Viewport prefetch on dynamic routes (limited in #711) | Prefetch only where the answer is cheap | About 52% of invocations came from prefetch |
| Promises shared between requests (fixed in #709) | A promise belongs to one request on Workers | Likely cause of `canceled` hangs, unproven |
| Security headers only in middleware | Headers that survive without middleware | Skipping middleware would drop them |

## Options

| | Astro files | Next.js files | Workers Cache |
|---|---|---|---|
| Worker on a page view | None | None | None on a hit; a miss renders |
| Needs Paid | No | No | In practice yes |
| JS and TBT | Measured 87-109 KB, TBT 60-138 ms | Unchanged: 195 KB, TBT 527-1397 ms | Unchanged |
| Navigation | Full loads | Client navigation likely, else full loads | Unchanged |
| Renderers | Two unless bodies are shared | One | One |
| Removal | Rebuild plus kill switch | Rebuild plus kill switch | Immediate purge by tag |
| Evidence on our pages | Pilot, 925 pages | None | None |

### Next.js files (first candidate: it improves the existing version)

- OpenNext has no feature for this. Its static-assets cache is read by the Worker through `ASSETS` from `cdn-cgi/_next_cache`.
- A post-build copy of prerendered HTML into assets works for page loads: `policai.org/` is served that way ([l0cka/policai#575](https://github.com/l0cka/policai/pull/575)), with no `x-opennext` header.
- Assets ignore query and headers, so `?_rsc=` gets HTML and the router falls back to a full load. That is safe, but fetches twice.
- A URL Rewrite rule on the `rsc` header may keep client navigation: policai's rule runs before asset matching, and pointing it at `{path}.rsc` should stay Worker-free. **Untested.** Free allows 10 Transform Rules; whether the rule behaves the same on Free was not confirmed.
- Needed: `text/x-component` in `_headers`; segment prefetch needs `x-nextjs-postponed: 2` and a segment rewrite, or `prefetch={false}`; `/` maps to `index.rsc`.
- Breaks: POST to an asset path returns 405 and never reaches the Worker, so `favorite-button` and `sign-out-form` must leave Server Actions. Middleware stops running on those URLs. Query-driven filters become client code.
- Risk: undocumented router internals. Pin Next and add an e2e test.
- Estimated 6-7k files with segments, against 20,000. Next build time for 925 SSG pages is unmeasured.

### Astro files (fallback if Next.js files do not meet the targets)

- The only option measured on our components. Pilot: JS 87-109 KB, TBT 60-138 ms at 4x throttle, all 925 pages in 3 min 16 s, 16 KB gzipped HTML.
- Two renderers: page assembly, head and metadata, similar recipes, skeleton and srcset would exist twice unless shared bodies and a parity test are added.
- React context does not cross islands, so the session store needs Nano Stores or similar.
- Links from Next screens must be `<a>`, not `<Link>`.
- An Astro-only build allows a separate assets Worker with a service binding for misses, which keeps content builds away from the app. Untested.
- Pilot gaps: inert favorite and sign-out stubs, empty suggestions, simplified similar recipes, no versions, gallery, analytics, metadata or JSON-LD.

### Workers Cache (needs Paid in practice)

- Answers from cache without running the Worker. Enabled with `"cache": { "enabled": true }` and `Cache-Control`; purge by tag with `ctx.cache.purge()`.
- Every request is billed, hit or miss; static asset requests are billed too once it is on.
- Keyed by Worker version by default, so each deploy starts empty. No pre-warming; the docs point pre-rendered content to Static Assets.
- A miss renders at 86 ms, so 1102 remains on Free. Untested with OpenNext.

### Rejected

- **Zone Cache Rules:** the request reaches the Worker before the cache, and rules match only the Worker's own subrequests. Cookie cache keys are Enterprise-only.
- **PPR and Cache Components:** nothing makes OpenNext emit page files; a resuming shell needs server compute, and reports show the Worker serving it.
- **vinext 1.4.3:** beta; assets are read through the Worker unless `output: export` is used. It had a shared-promise hang of the same class as #709.
- **`output: 'export'` second build:** no Server Actions, middleware or redirects; full loads between the builds.
- **React Router 8, TanStack Start 1.0:** a full rewrite (33 pages, 14 routes, 25 action files) that hydrates whole pages. Cloudflare's docs listed prerendering as unsupported with the React Router plugin; the upstream fix merged 2026-10-22, so that page may be out of date.
- **All of the app on Astro:** the same rewrite. Revisit only if a dynamic Astro page measures under 10 ms.
- **Other hosts:** Cloud Run about $0-5 a month plus a migration and cold starts; Hetzner from €5.99; MyDevil likely FreeBSD with no `@next/swc` binaries (unverified).

## Prior art

- **[Forem](https://github.com/forem/forem):** closest match. The same cached HTML for everyone, user data from `async_info/base_data`.
- **[plushies.dev](https://github.com/GromNaN/plushies.dev):** Astro, pre-rendered items, `LikeButton` calling Supabase from the browser. Tiny project.
- **[Mealie](https://github.com/mealie-recipes/mealie), [Tandoor](https://github.com/TandoorRecipes/recipes):** SPAs, nothing static.
- **based.cooking, [Cooklang](https://cooklang.org/guides/static-website/):** purely static, no personal state.

No mature recipe project combines static pages with personal state; Forem is the best evidence for the pattern.

## Code audit of the proposal

Graph of the three public pages and layouts: 161 modules, 67 tsx, 41 `use client`. 24 are framework-free, 27 need only a shim, 8 import actions, 8 need a rewrite (3 pages, 3 layouts, `app-shell`, `similar-recipes`).

- **Per-request work:** session (`load-recipe.ts`, `app-shell.tsx`, home and category pages); 7 recipe `searchParams`, category `tag`/`strona`, home `tab`/`fav_added`; 6 toasts plus `delete_error`; owner buttons, gallery, hearts, step photos, teaser. Home also picks the recipe of the day by date and swaps the hero for members.
- **Stay on the Worker:** merged-slug redirect (service key), hidden "unavailable", staff banner, `/u/{username}` 404.
- **From the browser, RLS allows:** favorites, `recipe_gallery_images` (authenticated, hidden filtered), `has_full_access`, own `recipes`, `recipe_shares`, `profiles`, `profiles_private`, `dish_versions`, `has_permission`, `recipe_hidden_for_viewer`, `search_recipes` (anon, limit clamp 140).
- **Needs a server:** `refreshRecipe` (limit, Inngest, access check), `/api/recipes/delete`, `/api/e`.
- **`step_images` has no RLS gate:** anon can read it in `public_recipes`; only `visibleStepImages` hides it. This exists today.
- **Session:** readable by JS (`httpOnly: false` in @supabase/ssr 0.12.7). `createSupabaseBrowserClient` has no callers, so browser refresh has never run here. Refresh could race with middleware; rotation has a 10 s reuse interval.
- **Silent breakage on Worker-free URLs:** HTTP to HTTPS (`custom-worker.ts`, #645); security headers; `/_next/image`; `_astro/*` not cache-first in `sw.js`; `--text-scale` flash on full loads; e2e, reflow and skeleton tests do not see static output; `smoke:prod` did not open recipes.

## Challenge findings still in force

- **Content deploys carry code-deploy risk:** each rebuild swaps the Worker while the post-deploy state is unexplained. Automate smoke, advance a watermark only on success, cap builds per day.
- **Takedown:** cron 5 + running build 7 + new build 7 gives about 19 minutes; a failed build makes it unbounded. `updated_at` cannot see hard deletes. A kill switch is needed; a zone redirect rule was proposed but not checked in the docs.
- **Scale:** 0.21 s per page reaches the 20-minute build timeout near 5,000 recipes; 20,000 files is the Free limit. Bulk read, external CSS and incremental output are needed before that.
- **List lag:** new recipes are missing from static cards until a rebuild; merge fresh rows from Supabase.
- **Search from the browser:** no app rate limit, and guest IPs reach Supabase; check the privacy policy.
- **Images direct from Supabase:** 5 GB egress limits are a risk.

## Platform facts checked (2026-11-05)

- [Static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): free and unlimited, no Worker unless `run_worker_first` matches. [Limits](https://developers.cloudflare.com/workers/platform/limits/): 20,000 files on Free, 25 MiB each, 100,000 requests a day.
- [`_headers`](https://developers.cloudflare.com/workers/static-assets/headers/): assets only, 100 rules. Default `public, max-age=0, must-revalidate`.
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/): 3,000 minutes a month, one at a time, 20 minutes, 8 GB. [Deploy Hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/): POST to a secret URL.
- [Workers Cache](https://developers.cloudflare.com/workers/cache/), [limitations](https://developers.cloudflare.com/workers/cache/limitations/).
- Paid: $5 a month, 10M requests, 30M CPU ms. Measured use: 196k requests and 10.2M ms in 31 days; about 22M ms in the worst case, if every failure had cost p99.
- CPU guidance: Cloudflare says SSR and auth work typically takes 10-20 ms ([limits](https://developers.cloudflare.com/workers/platform/limits/)).

## Not verified

- CPU of other frameworks on workerd; JS or TBT of React Router or TanStack with our components.
- Worker-free serving of `.rsc` through a rewrite rule, and that rule on the Free plan.
- Next build time for 925 SSG pages.
- Workers Cache with OpenNext and query strings.
- Whether a Deploy Hook builds the latest commit; asset retention after deploys.
- Why a new deployment shows a high error rate; who sent those requests.

## General sources

Mostly blogs and vendors, so weaker than the measurements above; Vercel, Cloudflare, TanStack and Astro figures are self-reported.

- Session reads making routes dynamic: [one line in a root layout](https://dev.to/ricardo_diazmiralles/one-line-in-your-root-layout-can-make-every-nextjs-page-render-on-demand-24o0), [precompute pattern](https://dev.to/0xtanzim/the-precompute-pattern-how-to-stop-one-cookie-from-wrecking-your-entire-nextjs-app-m40), [Next.js discussion](https://github.com/vercel/next.js/discussions/54662).
- Next on Cloudflare: [OpenNext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/), [OpenNext caching](https://opennext.js.org/cloudflare/caching), [benchmarks](https://blog.cloudflare.com/unpacking-cloudflare-workers-cpu-performance-benchmarks/), [vinext](https://github.com/cloudflare/vinext).
- Content sites: [Netlify on durable cache](https://www.netlify.com/blog/durable-cache-quest-for-fast-fresh-content), [SSR to ISG](https://zoelog.vercel.app/articles/frontend/migrating-ssr-to-isg-production), [10k pages](https://dev.to/danie_rozin/isr-on-demand-revalidation-and-10k-product-pages-our-nextjs-scaling-playbook-1jgj).
- Frameworks: [Astro islands state](https://docs.astro.build/en/recipes/sharing-state-islands/), [multi-zones links](https://nextjs.org/docs/app/guides/multi-zones), [static exports](https://nextjs.org/docs/app/guides/static-exports), [React Router on Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/), [TanStack Start prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering).
- Browsers: [View Transitions support](https://caniuse.com/cross-document-view-transitions); Speculation Rules are Chromium-only.
