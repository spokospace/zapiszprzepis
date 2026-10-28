# Execution plan — extraction-rate-limit

Issue: #383 (E02-S11-T04). Source doc: `context/foundation/code-audit-2026-10-20.md` §3d D4.

## Goal

Cap how often one account can start a paid recipe extraction, in all four entry points
(add form, Web Share Target, „Odśwież przepis”, „Ponów”), and tell the user to try later.

## Scope

- A Workers `ratelimits` binding `EXTRACTION_LIMIT` keyed by user id, read through a shared
  limiter helper that the Exa limiter also uses.
- The check runs after the full-access gate and before any `recipe_shares` write or
  `recipe/extract` event in each entry point.
- A new `rate_limited` add error („spróbuj później” copy) for add, share and retry; a
  `refresh_error=rate_limited` toast on the recipe page.

## Decisions

- **Window.** Workers Rate Limiting only accepts a `period` of 10 or 60 seconds, so the
  proposed „20 per hour” cannot be expressed by the binding. Use 5 per 60 s: enough for a
  person adding a few links in a row, and it turns a scripted loop into a bounded rate
  (≤ 300 per hour) instead of an unbounded one.
- **Fail open.** Like Exa: no Workers runtime (`next dev`), a missing binding or a limiter
  error lets the extraction through and logs. Every entry point is already behind the
  fail-closed full-access gate, so only code/paid accounts reach it; failing closed would turn
  a limiter outage into „nobody can add recipes”.
- **Retry** redirects to `/dodaj?add_error=rate_limited`, the same exception the no-access
  gate already makes for „Ponów”.

## Non-goals

- No DB-backed hourly/daily quota, no per-plan limits, no admin override.
- No change to the refresh script (`queueRecipeRefresh` callers outside the actions).

## Risks

- Limiter counts are per Cloudflare location and approximate; acceptable for cost control.
- A real user batch-sharing more than 5 links in a minute sees the message; the copy asks
  them to wait a moment.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Limiter

- [ ] 1.1 Shared Workers rate-limit helper + extractionAllowed + EXTRACTION_LIMIT binding

### Phase 2: Entry points

- [ ] 2.1 Gate add, share, refresh and retry; show the rate-limited message
