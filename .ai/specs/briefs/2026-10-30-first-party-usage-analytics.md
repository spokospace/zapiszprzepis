# First-party, cookieless usage analytics for recipes, categories and feature use

- Date: 2026-10-30
- Category: feature
- Priority signal: medium — informs which categories and features to invest in
- Risk signal: medium — changes a public privacy promise (privacy policy section 6) and adds an unauthenticated write endpoint

## Problem
The owner wants to understand how people use the site: which recipes and categories are popular (to decide which categories to grow with more recipes) and which recipe-page features get used (cooking timer, print, favorites, ingredient checkboxes). There are no ads, so no AdSense consent applies, but GA4 sets cookies and would require a consent banner for Polish/EU users, which the owner does not want because of its expected cost in bounce rate (not measured on this site). Cloudflare edge analytics work with the owner's token but count HTTP requests including bots: since 2026-10-12 weekly requests rose about 5x (about 60k, 86k, 49k) while page views rose about 3x (about 5k, 15.7k, 14.7k), so edge numbers cannot rank categories for real readers. All 13 `/przepisy/{category}` pages exceed 100 requests per week; obiady and ciasta lead.

## Agreed direction
- Build a first-party, cookieless counter on the same domain. A same-domain endpoint receives page-view and click events and stores only daily aggregate counters (day, event name, recipe slug or category key). No IP stored, no cookie, no localStorage/sessionStorage dedupe, no session id, no fingerprint. The client must send no identifier at all; this is a hard constraint because the "no consent needed" position depends on it.
- Page views are counted in the browser so bots, which mostly do not run scripts, do not dominate the ranking. Cloudflare edge numbers stay as a rough cross-check only.
- Events first: recipe view, category view, cooking timer start, print, favorite toggle, ingredient checkbox. The final list and the decision each supports are decided in the spec.
- Rejected: GA4 (cookies, banner, data to Google in the US); Plausible Cloud (paid, external script prone to blockers); self-hosted Plausible (needs ClickHouse and Postgres); Cloudflare Web Analytics alone (no custom click events, may need the beacon injected manually on a Worker-served site; possible complement only).
- "Build nothing" lost: edge data is bot-polluted and cannot answer whether people use the timer or print. Search Console impressions remain a free complement for category demand.

## Resolved unknowns
- GA4: rejected because it needs a PL/EU consent banner; no ads on the site.
- Own solution chosen by the owner, reusing Supabase and the admin panel.
- Cloudflare read-only API access works (account 7a4ca0444df1850c59cc436a4ff3ea71); per-path data reaches only about 4 weeks back and is sampled.
- Real human volume is unknown until browser-side counting runs.
- Issue and PR text must be English.

## Non-goals
- No GA4, no third-party analytics script, no cookies, no per-user or per-session tracking, no consent banner, no funnels.
- No IP address or user identifier in the new table.
- Do not change the privacy policy text before a legal read; the spec must include a drafted section 6 and name who approves it.

## Affected areas / open items for the spec
- `src/app/(legal)/polityka-prywatnosci/page.tsx`, section 6, currently says no traffic-tracking tools are used.
- Open: written legal read (UODO guidance or a privacy lawyer) before the policy changes, and who approves the wording; whether Cloudflare/Workers request logs retain client IPs and how that matches the policy; whether an admin-panel read view is needed or a saved Supabase SQL query is enough; rate limiting and an allowlist of event names and category keys for the unauthenticated endpoint; the Workers free-tier CPU ceiling (keep per-event work minimal); the decision each metric supports.
