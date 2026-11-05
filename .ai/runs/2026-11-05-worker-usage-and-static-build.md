# Worker usage and static build measurement (2026-11-05)

Sources: Cloudflare GraphQL `workersInvocationsAdaptive` (project token, 2026-10-06 to 2026-11-05 15:00 UTC), Workers Observability in the dashboard (last 24 h), read-only SQL on production, and a local full-catalogue build of the Astro pilot. The 24 h window includes this session's own probes, which cannot be separated out.

## Usage, 31 days

| Measure | Value |
|---|---|
| Worker requests | 195,632 (peak 20,239 per day; Free limit 100,000 per day) |
| `exceededResources` (error 1102) | 15,514, or 7.9% |
| CPU total | about 10.2 million ms, which fits the 30 million ms Workers Paid includes per month |
| Median CPU of successful requests | 2.5-8 ms until 2026-10-17, 10-57 ms after |
| p90 / p99 CPU, recent days | about 160-240 ms / 600-770 ms |

The rise in CPU follows the catalogue import of 2026-10-16 (622 recipes in a day) and the E01 screens. Which of the two drives it was not measured.

Days with the most failures: 10-27 (2,725), 10-20 (2,460), 10-29 (2,085), 10-30 (1,612), 10-28 (1,543), 11-04 (1,380), 11-01 (1,308).

## CPU per route, last 24 h

10,143 `fetch` invocations (652,081 ms CPU, median 16 ms, p90 169 ms) and 257 `scheduled` (4,275 ms, median 15 ms). So crons are not the cause; the earlier open question is closed.

The 1,000 most frequent URLs cover 6,787 invocations and 459,302 ms (70% of CPU). The rest is a long tail of single URLs that was not classified.

| Route | Requests | CPU ms | Share of classified CPU | Mean CPU |
|---|---:|---:|---:|---:|
| `/przepis/*` HTML | 2,014 | 173,058 | 37.7% | 86 ms |
| `/przepis/*` RSC | 801 | 68,652 | 14.9% | 86 ms |
| `/` HTML | 225 | 39,787 | 8.7% | 177 ms |
| `/przepisy/*` RSC | 633 | 27,586 | 6.0% | 44 ms |
| `/przepisy/*` HTML | 95 | 22,252 | 4.8% | 234 ms |
| `/szukaj` RSC + HTML | 435 | 24,262 | 5.3% | 56 ms |
| `/recipes` HTML + RSC | 119 | 19,627 | 4.3% | 165 ms |
| `/lab` HTML (route since removed) | 700 | 13,812 | 3.0% | 20 ms |
| `/` RSC | 277 | 11,886 | 2.6% | 43 ms |
| `/ulubione` RSC + HTML | 172 | 9,311 | 2.0% | 54 ms |
| `/login` HTML + RSC | 169 | 9,659 | 2.1% | 57 ms |
| `/u/*` RSC | 125 | 8,118 | 1.8% | 65 ms |
| `/_next/image` | 152 | 984 | 0.2% | 6 ms |

`/przepis/*`, `/` and `/przepisy/*` together: 343,221 ms, 74.7% of the classified CPU.

The `/_next/image` count is a lower bound, because image URLs are often unique and fall outside the top 1,000.

## Latest deployment

Version `a6b58151` (#712), deployed about 14:10 UTC. Dashboard at about 15:00: error rate 29.2%, median CPU 19.92 ms. GraphQL: 14:00 hour 185 `exceededResources` of 699, 15:00 hour 32 of 38 up to 15:05. `pnpm smoke:prod` passed at 15:05, so it does not catch this state. The traffic source of these requests is unknown.

## Content

| Measure | Value |
|---|---|
| Public recipes | 925 |
| All public fields as JSON | 2.42 MB, mean 2.7 KB, largest 6 KB |
| All cards as JSON | 518 KB, 71 KB gzipped |
| Cards plus description and ingredients (search index) | 1.35 MB, 174 KB gzipped |
| Accounts / favorites | 7 / 16 |
| New recipes, last 7 days | 21 |
| Recipes with `updated_at` over 1 h after creation, last 21 days | 837 rows on 12 days: 493 on 10-18, 96 on 11-04, 91 on 10-17; 9 days had none |

`updated_at` includes staff backfills, so it overstates what authors change. All 924 photos are on Supabase Storage.

## Platform limits checked

- Static assets: free and unlimited requests, 20,000 files per version on Free, 25 MiB per file. They do not invoke the Worker unless `run_worker_first` matches.
- `_headers`: applies to assets only, up to 100 rules.
- Workers Builds on Free: 3,000 minutes per month, one build at a time, 20 minute timeout, 8 GB memory, 20 GB disk. The latest build took 3 min 0 s.
- Deploy Hooks: a POST to a secret URL starts a build of one branch; 10 builds per minute per Worker.

## Full-catalogue static build

The Astro pilot from `exp/astro-pilot`, changed only to list every slug, built locally on this Windows machine against production Supabase:

| Measure | Value |
|---|---|
| Pages built | 925 of 925, no errors |
| Time | 3 min 16 s, with about four sequential Supabase reads per page |
| Files | 947, against the limit of 20,000 |
| Size | 107 MB uncompressed, about 118 KB per page because CSS is inlined |
| Size gzipped | median 16 KB per page, largest 17.5 KB (sample of 40) |
| Shared JS and assets | 354 KB in 22 files |

The pilot leaves out dish versions, the gallery teaser, analytics and the signed-in overlay, so a real page will be somewhat larger. One bulk read instead of per-page reads should shorten the build; that is untested. Next.js (3 min) plus this gives about 6-7 min per deploy, so 3,000 build minutes allow roughly 450 builds a month, about 15 a day. Workers Builds speed may differ from this machine.
