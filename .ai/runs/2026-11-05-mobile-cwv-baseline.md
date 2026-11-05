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
