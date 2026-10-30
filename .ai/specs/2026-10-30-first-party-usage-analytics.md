# First-party cookieless usage analytics

Brief: `.ai/specs/briefs/2026-10-30-first-party-usage-analytics.md` (its "Resolved unknowns" are treated as answered). Status: spec for review; nothing is implemented.

## 📝 TLDR
The owner needs to know which recipes and categories real readers use (to decide which categories to grow) and which recipe-page features get used. Today the only data is Cloudflare edge request counts, which are bot-polluted. **Proposed (future behavior):** a same-domain, cookieless endpoint that stores only daily aggregate counters (day, event, recipe slug or category key), fed by browser-side events so most bots never register. The client sends no identifier and the server stores none. It ships dark behind a flag and is switched on only after the owner approves the new privacy-policy wording.

## 📝 Problem Statement
- Edge data counts HTTP requests including bots: since 2026-10-12 weekly requests rose about 5x (≈60k, 86k, 49k) while page views rose about 3x (≈5k, 15.7k, 14.7k). It cannot rank the 13 `/przepisy/{category}` pages for real readers nor say whether the timer or print are used.
- GA4 would need a PL/EU consent banner; rejected by the owner (no ads, banner cost in bounce rate).
- `src/app/(legal)/polityka-prywatnosci/page.tsx` section 6 ends "Nie używamy ciasteczek reklamowych ani narzędzi, które śledzą ruch na stronie." That sentence becomes inaccurate once counters ship.

## 📝 Proposed Solution
A tiny beacon (`track(event, subject)`) in the browser posts `{e, s}` to `POST /api/e`; the route validates against an allowlist and calls one Supabase RPC that does `insert … on conflict do update set count = count + 1` on a daily row. Reading is SQL first (P1/P3), an admin page later (P4).

Decisions taken (Q1–Q9, all recommended answers accepted):
- One spec, phased; the policy change is its own gated phase (Q1, Q8).
- Events and the decision each supports (Q2, Q3):

| Event | Subject | Decision it supports |
|---|---|---|
| `recipe_view` | recipe slug | which recipes to promote / which dishes readers want more of |
| `category_view` | category key (`RECIPE_CATEGORIES`) | which categories to grow with more recipes |
| `timer_start` | recipe slug | is the cooking timer worth maintaining / more timer UX |
| `print` | recipe slug | is the print button used (the button, not Ctrl+P) |
| `favorite_add` | recipe slug | what readers want to keep; cross-check with `favorites` table |

  `ingredient_check` is deferred (no dedupe is allowed, so every tick would count). Favorite removal is not counted: only adds carry signal. No other dimensions (no referrer, device, hour).
- Supabase RPC write path, not Analytics Engine (Q5). Revisit only if measured CPU per event fails the budget below.
- Abuse control (Q6): event allowlist, subject format check, Cloudflare rate-limit binding; unknown slugs are tolerated at write time and ignored at read time (join to `recipes`). Skewing by a determined abuser is accepted: a decision aid, not billing.
- Honor GPC/DNT (Q7); staff are not excluded.
- Retention (Q9): keep rows indefinitely; size is days × events × subjects.

Alternatives that lost: see the brief (GA4, Plausible Cloud/self-hosted, Cloudflare Web Analytics alone, building nothing).

## 📝 Architecture
- **Client** `src/lib/analytics/track.ts` (client-only): no-op when `NEXT_PUBLIC_USAGE_ANALYTICS !== '1'`, when `navigator.globalPrivacyControl` is true, when `navigator.doNotTrack === '1'`, or when `navigator.webdriver` is true. Otherwise `navigator.sendBeacon('/api/e', new Blob([JSON.stringify({e, s})], {type: 'text/plain'}))`, falling back to `fetch(..., {method:'POST', keepalive:true, credentials:'omit'})`. Nothing is read from or written to cookies/storage by this code.
- **Instrumentation points** (existing components): a small `<TrackView event subject />` client component mounted by `przepis/[slug]/page.tsx` and `przepisy/[kategoria]` page (fires once per mount via a ref, in `useEffect`; prefetch does not run effects, so only real views count; guest pages are cached, so counting must be client-side by design); `timer-provider.tsx` `start`; `print-button.tsx` click; `favorite-button.tsx` on add.
- **Route** `src/app/api/e/route.ts`: reads only the body and the `User-Agent` header (to drop `bot|crawl|spider|headless|lighthouse|preview` UAs; the UA is not stored). Never reads cookies, `cf-connecting-ip` or any other header into storage. Order: flag off → 204; body > 256 B → 400; allowlist/format → 204 (silent, so probes learn nothing); rate limit → 204 on exceed; RPC; always `204`, no body. RPC errors are logged with `console.error` and swallowed (analytics must never surface errors).
- **Rate limit**: new `USAGE_LIMIT` binding in `wrangler.jsonc` (`namespace_id` unique in the account, e.g. 1004; ~120 per 60 s), keyed by client address via the existing `withinRateLimit` (`src/lib/rate-limit.ts`, which fails open). The address is passed to Cloudflare's limiter only as a transient key; our code and database never store it (same status as the address in hosting logs the policy already discloses in sections 2 and 7).
- **Middleware**: `src/middleware.ts` runs on every non-static path, including `/api`, and refreshes the Supabase session. `/api/e` must be added to the matcher exclusions: it saves a session check per event (CPU) and guarantees the endpoint never touches the auth cookie the browser attaches to same-origin beacons. The security-header block does not matter for a 204 JSON-less response.
- **CPU budget** (Workers free tier ≈10 ms): one JSON parse, set-membership checks, one rate-limit call, one RPC `fetch`. Use `ctx.waitUntil` for the RPC so the 204 returns before the DB round trip. Phase 1 includes measuring CPU on a deployed preview before enabling.
- Existing consumers and dependencies: none change behaviour; admin read view (P4) depends on the staff permission model in `.ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md`.

## 📝 Data Model
New migration `supabase/migrations/2026103x…_usage_counters.sql` (idempotent, following `20261030100000_staff_tokens.sql`):

```
usage_counters (
  day     date    not null,            -- Europe/Warsaw calendar day
  event   text    not null check (event in ('recipe_view','category_view','timer_start','print','favorite_add')),
  subject text    not null check (char_length(subject) between 1 and 120),
  count   bigint  not null default 0,
  primary key (day, event, subject)
)
```
- RLS enabled, **no policies** (no anon/authenticated access).
- `usage_count(p_event text, p_subject text)` `security definer`, `set search_path = ''`, executable by `service_role` only: validates the event, computes `day` server-side as `(now() at time zone 'Europe/Warsaw')::date`, upserts `count + 1`. The client never supplies a date.
- Read RPCs for P4 (`admin_usage_summary`) are separate and gated by a staff permission (e.g. `analytics.read`; exact name decided when P4 is built against the permission registry).
- Sensitive data: none. No IP, UA, user id or timestamp finer than a day.
- Migration is applied to production only with the owner's explicit go (local dev points at the production DB; Management API process in the project memory). It is additive and rollback is `drop table`/`drop function`.

## 📝 API Contracts
`POST /api/e`, `Content-Type: text/plain` (or `application/json`), body ≤ 256 bytes:
```
{"e":"recipe_view","s":"szarlotka-babci"}
```
Validation: `e` ∈ allowlist; `s` for `category_view` ∈ `RECIPE_CATEGORIES` values; for the other events `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 120 chars (recipe slugs; confirm against the slug generator in P1). Response: `204` in every case except malformed/oversized body (`400`). Same origin only; no CORS headers. No response body, no `Set-Cookie`.

## 📝 UI/UX
No visible UI to readers: no banner, no toggle. P4 only: `/admin/statystyki` (Polish, matching `src/app/admin/ui.tsx`): last 7/30 days, top categories (with each category's recipe count, so "popular" is not just "large"), top recipes, feature-use counts, with a note that numbers are anonymous counts, not unique visitors.

## 📝 Edge Cases & Failure Scenarios
- **JS-capable bots** (Googlebot renders JS): UA filter and `navigator.webdriver` drop the obvious ones; a residue remains. Read side compares with Cloudflare edge numbers as a sanity check.
- **Soft navigation / back-forward cache** can count a view again; accepted, it is a count of views not visitors.
- **Reload spam** inflates one recipe; no dedupe is allowed by design. Rate limit bounds it per address.
- **DB down / RPC fails:** swallowed, one `console.error`; reader sees nothing.
- **Beacon blocked by an ad blocker:** undercount, uniform enough to compare categories; absolute numbers are a lower bound.
- **Flag off / policy not approved:** client sends nothing, server returns 204 without writing.
- **Recipe renamed/merged/deleted:** subject slug may no longer exist; rows stay, reads join to `recipes` and show orphans separately or drop them. Merged recipes redirect (`merged-recipe-redirect.ts`), so the final slug is what the page reports.
- **Staff/QA browsing** is counted (Q7); QA accounts are a rounding error.
- **Day boundary:** computed in the DB in `Europe/Warsaw`, so no client clock influence.

## 📝 Risks & Impact Review
- **Legal/privacy (hard to reverse publicly):** the new wording is a public promise. Counting is intended to fall outside consent requirements because our code reads nothing from and writes nothing to the device, the client sends no identifier, and the server stores none. Transiently, the browser attaches the auth cookie (ignored: the route never reads it) and the network exposes IP and User-Agent to the Worker (the IP is used only as a rate-limit key, the UA only for a bot check; neither is stored); this is the owner's position and needs the written read (Q8) before the flag is on. Risk is borne by the owner as controller.
- **Unauthenticated write endpoint:** bounded by allowlist, size cap, rate limit, no read path, no secrets in responses. Worst case is skewed counters.
- **Cost:** one extra Worker invocation and Supabase write per event; with `waitUntil` it adds no reader latency. Supabase free-tier write volume at the current ≈15k page views/week is trivial.
- **Hard-to-reverse:** only the policy text. Schema is additive; the endpoint can be removed.
- **Product-direction call (not a rule violation):** page views are counted in the browser, so users with JS disabled or blockers are invisible. Accepted by the owner.

## 📝 Decisions in play
No `product-brief.md` exists. The brief's Non-goals bind this spec: no cookies/identifiers/consent banner/funnels, no IP or user id in the table, no policy text change before a legal read. Superseding none.

## 📝 Drafted privacy-policy change (needs owner approval; owner = `spokospace`, Szymon)
Section 6 final paragraph replaces "Nie używamy ciasteczek reklamowych ani narzędzi, które śledzą ruch na stronie." with:

> **Anonimowe liczniki wejść** — gdy otwierasz przepis lub kategorię albo użyjesz minutnika, drukowania lub dodasz przepis do ulubionych, strona wysyła do nas jedną anonimową informację: co to było i którego przepisu albo której kategorii dotyczyło. Dopisujemy ją do dziennego licznika, np. „12 maja: kategoria obiady – 340 wejść”. Nie zapisujemy Twojego adresu IP, nie ustawiamy ciasteczek, nie zapamiętujemy niczego na Twoim urządzeniu i z tych liczników nie da się poznać, kim jesteś ani czy wróciłeś lub wróciłaś. Nic nie wysyłamy, gdy przeglądarka ma włączone „Nie śledź” albo Global Privacy Control. Liczniki służą nam do decydowania, jakich przepisów dodawać więcej.
>
> Nie używamy ciasteczek reklamowych ani zewnętrznych narzędzi analitycznych (takich jak Google Analytics).

Section 7 gets a bullet: „Dzienne liczniki wejść — bez ograniczenia czasu; nie zawierają danych osobowych.” Wording is neutral and avoids gender forms per the project rule (the "wróciłeś lub wróciłaś" form matches existing policy phrasing).

**Approval path (Q8):** the owner reads the UODO and EDPB guidance on cookieless audience measurement (or has a privacy lawyer read it) and records approval as a PR comment; only then is `NEXT_PUBLIC_USAGE_ANALYTICS=1` set and the policy text merged (same PR as enabling).

## 📋 Phasing
1. **P1 Collector (dark):** migration, validation lib, route, rate limit, middleware exclusion, flag. Shippable alone; writes nothing user-visible, nothing is sent by clients.
2. **P2 Instrumentation (dark):** `track()` and the five call sites. Still gated by the flag.
3. **P3 Go-live:** policy text, flag on, SQL queries doc, production smoke. Blocked on owner approval of the wording.
4. **P4 Admin view** `/admin/statystyki` (optional, after a few weeks of data).

## 📋 Implementation Plan
**Phase 1 — Collector**
1. Migration `usage_counters` + `usage_count()` RPC, service-role-only grants, idempotent; Management-API apply step written in the PR as a manual runbook (owner's go required).
2. `src/lib/analytics/events.ts`: allowlist, subject validators, bot-UA test; unit tests for every accept/reject case (slug regex vs real slugs, all `RECIPE_CATEGORIES`, oversize, unknown event).
3. `USAGE_LIMIT` binding in `wrangler.jsonc` and `RateLimitBinding` union; rate-limit test following `exa-rate-limit.test.ts`.
4. `src/app/api/e/route.ts` (204 contract, flag, `waitUntil` RPC, never reads cookies); route tests with a mocked service client.
5. Add `api/e` to the `src/middleware.ts` matcher exclusions; test that the matcher does not match it.
5a. Runbook (PR description): apply the migration from step 1 to production with the owner's go **before** any flag-on test; until then route writes fail, are swallowed, and the flag is off, so nothing breaks.
5b. Measure Worker CPU per event on a deployed `master` build with the flag temporarily on for a controlled burst (Observability logs); record the result in `docs/usage-analytics.md`. If it exceeds the budget, stop and revisit Q5 (Analytics Engine).

**Phase 2 — Instrumentation**
6. `src/lib/analytics/track.ts` with GPC/DNT/webdriver/flag gating; tests for each no-op condition and for the no-identifier body (assert request carries only `e`, `s`, and uses `credentials: 'omit'` on the fetch fallback).
7. `<TrackView>` on recipe page and category page; once-per-mount test.
8. Hook `timer_start`, `print`, `favorite_add`; component tests that each fires exactly once per action and not on favorite removal.

**Phase 3 — Go-live (after owner approval)**
9. Privacy-policy section 6/7 text as drafted; update the policy page test if one asserts the old sentence.
10. `docs/usage-analytics.md`: the saved SQL queries (top categories, top recipes joined to `recipes`, feature use, last 7/30 days) and the CPU measurement result; set the flag; run `pnpm smoke:prod`; verify one real event lands in the table on production, then remove that test row via the Management API (service-role SQL, the same path as migrations; the table has no delete policy by design).

**Phase 4 — Admin view**
11. `admin_usage_summary` read RPC + staff permission `analytics.read`, registry entry.
12. `/admin/statystyki` page reusing `src/app/admin/ui.tsx`; test the permission gate.

## 🧪 Review limits
Written from reading the brief, the privacy page, `rate-limit.ts`, `wrangler.jsonc`, `middleware.ts` matcher, `exa-rate-limit.ts`, and the admin page pattern. Not verified: the recipe slug character set, the exact staff-permission registry shape, the CPU cost of the route on the free tier (a P1 measurement), and the legal position itself (Q8).
