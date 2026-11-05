# Mobile CWV baseline, production (2026-11-05)

Lab measurement, not field data: Playwright Chromium, 412x823 phone profile, Slow 4G (150 ms, 1.6 Mbps), 4x CPU throttling, cache off, service worker blocked, guest, median of 3 runs. PageSpeed Insights was unavailable (quota). TBT is summed long tasks over 50 ms, a lab stand-in for INP.

| Page | TTFB | FCP | LCP | CLS | TBT | Load | Total | JS | Requests | RSC |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | 66 ms | 1112 ms | 2392 ms | 0.08 | 115 ms | 2648 ms | 474 KB | 181 KB | 34 | 11 |
| `/przepis/zupa-pomidorowa` | 62 ms | 1164 ms | 2108 ms | 0 | 527 ms | 2411 ms | 360 KB | 195 KB | 25 | 4 |
| `/przepis/zapiekanka` | 91 ms | 1192 ms | 2188 ms | 0 | 1067 ms | 3019 ms | 343 KB | 195 KB | 27 | 4 |
| `/przepis/barszcz-ukrainski-5` | 67 ms | 1092 ms | 2476 ms | 0 | 839 ms | 3157 ms | 337 KB | 195 KB | 27 | 4 |
| `/przepis/kajzerki` | 87 ms | 1220 ms | 2996 ms | 0 | 1397 ms | 3196 ms | 358 KB | 195 KB | 25 | 4 |

Thresholds: LCP good up to 2500 ms, CLS up to 0.1, Lighthouse TBT good up to 200 ms.

Reading:
- The weak point of recipe pages is main-thread JavaScript: TBT 527-1397 ms, 2.6-7x the threshold. The home page is fine at 115 ms.
- LCP is an image on every page and is near the threshold; `kajzerki` is over it.
- TTFB values are guest edge-cache `HIT`s (#704). First runs that missed took 554-896 ms, and the medians hide them. Signed-in readers do not get the cache.
- All 15 runs answered `200`, none failed. TBT varied a lot between runs of one page (for example 525-1509 ms on `kajzerki`).
- Not covered: real devices, field data, signed-in pages, INP from real input.

Script: `cwv.cjs` in the session scratchpad (Playwright + CDP throttling).

## Astro pilot vs production, same profile, measured alternately (2026-11-05)

Static Astro page at `/pilot/{slug}/` from Workers Static Assets on a branch preview (`exp/astro-pilot`), production CSS and image pipeline, against `/przepis/{slug}` on production. Median of 3 runs, 24 of 24 runs answered `200`.

| Recipe | LCP pilot / now | TBT pilot / now | FCP pilot / now | TTFB pilot / now | Total pilot / now | Requests pilot / now |
|---|---|---|---|---|---|---|
| `zupa-pomidorowa` | 1072 / 2092 ms | 0 / 529 ms | 1016 / 1144 ms | 305 / 74 ms | 83 / 358 KB | 3 / 25 |
| `zapiekanka` | 960 / 1852 ms | 0 / 808 ms | 940 / 1084 ms | 302 / 76 ms | 57 / 346 KB | 3 / 27 |
| `barszcz-ukrainski-5` | 828 / 1712 ms | 0 / 507 ms | 812 / 1152 ms | 319 / 82 ms | 51 / 337 KB | 3 / 27 |
| `kajzerki` | 1052 / 2052 ms | 0 / 435 ms | 1008 / 1092 ms | 339 / 67 ms | 82 / 360 KB | 3 / 25 |

**This is an upper bound, not a forecast.** The pilot has no JavaScript beyond one inline script and leaves out the menu, footer, list bar, favorites, servings scaling, units, cooking mode, timers, glossary, gallery, versions, similar recipes and analytics. Its real TBT would be above 0. The production TTFB here is the guest edge-cache `HIT`, and the pilot runs on a `workers.dev` preview, so TTFB is not comparable. Production TBT moved between measurements (`kajzerki` 1397 ms, then 435 ms).

## Fuller Astro pilot vs production (2026-11-05)

The recipe's real React components are hydrated as islands: `RecipeActions` (`client:load`: cooking mode, favorites, print, share) and `RecipeChecklists` (`client:visible`: servings, units, step timers, glossary, ticks). Static: header with a simple menu, similar recipes, footer. Same profile, plus a scroll through the page so lazy islands count on both sides. Alternating, median of 3, 24 of 24 runs answered `200`.

| Recipe | LCP pilot / now | TBT pilot / now | Total pilot / now | Requests pilot / now | RSC now |
|---|---|---|---|---|---|
| `zupa-pomidorowa` | 1120 / 2152 ms | 68 / 810 ms | 243 / 525 KB | 12 / 36 | 10 |
| `zapiekanka` | 888 / 2300 ms | 138 / 867 ms | 207 / 541 KB | 12 / 48 | 17 |
| `barszcz-ukrainski-5` | 824 / 1908 ms | 60 / 1009 ms | 211 / 488 KB | 12 / 46 | 15 |
| `kajzerki` | 1240 / 2228 ms | 114 / 1383 ms | 252 / 620 KB | 12 / 40 | 14 |

JS 87 KB against 195 KB. HTML 36-51 KB against about 183 KB. CLS 0 on both. Across runs the ranges do not overlap: pilot TBT 44-264 ms, production 689-2036 ms. Checked in a browser: islands hydrate, ticking an ingredient works, no app errors.

Still left out: list bar with Previous/Next, dish versions, the real menu drawer, analytics, and the signed-in overlay (session store, supabase-js), which signed-in readers would pay for. Full page loads between recipes were not measured. Lab profile only, one session, `workers.dev` preview, so TTFB is not comparable.
