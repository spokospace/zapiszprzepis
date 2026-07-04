<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-06 Error UX — notification bell + author alerts

- **Plan**: context/changes/error-ux-and-author-alerts/plan.md
- **Scope**: Faza 1 & 2 (Faza 3 — author email — not started, out of scope)
- **Date**: 2026-07-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Plan adherence: all 9 planned files MATCH, no MISSING/DRIFT/EXTRA (diff touches exactly the planned files). Success criteria: `pnpm typecheck` clean, `pnpm lint` 0 errors, `pnpm build` compiled.

## Findings

### F1 — Non-http URL rendered as clickable href in the bell

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/components/notification-bell.tsx:91-98
- **Detail**: `share.shared_url` is rendered directly into `<a href={share.shared_url}>`. The add path validates only with `new URL(url)` (accepts `javascript:`/`data:` schemes) and `normalizeUrl` preserves the protocol. A failed share whose URL uses a non-http scheme lands in the bell as a clickable href. `target="_blank" rel="noopener noreferrer"` mitigates but doesn't fully neutralize. Low real-world likelihood (self-XSS, per-user RLS).
- **Fix**: Gate the anchor on `share.shared_url.startsWith('http')` — render the URL as plain text otherwise (or enforce an http/https allow-list at the add boundary).
- **Decision**: FIXED (Fix now)

### F2 — retry reset is not a compare-and-swap (double-dispatch race)

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/(authenticated)/recipes/retry-action.ts:38-45
- **Detail**: The `status !== 'failed'` guard is checked on the SELECT, but the UPDATE to `pending` keys only on `.eq('id', …)`. Two concurrent "Ponów" clicks can both pass the SELECT and both dispatch `recipe/extract` → duplicate extraction. `disabled={pending}` makes it unlikely; extraction may be idempotent.
- **Fix**: Add `.eq('status', 'failed')` to the reset UPDATE and treat a zero-row result as "already handled".
- **Decision**: FIXED (Fix now)

### F3 — getFailedShares swallows query error → silently empty bell

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/failed-shares.ts:30-38
- **Detail**: `const { data: failed } = …` discards `error`. A query failure renders an empty bell — a failed extraction becomes invisible, the exact "silently lost" NFR this feature upholds. Consistent with the codebase's swallow-and-continue style, but this feature's intent argues for a log.
- **Fix**: Destructure and `console.error` the `error` from the failed-shares query.
- **Decision**: FIXED (Fix now)

### F4 — getUser() vs the getSession() lesson

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/supabase/server.ts:49
- **Detail**: `requireUser()` uses `auth.getUser()`; lessons.md says prefer `getSession()` downstream of the proxy. This is a pre-existing, codebase-wide deviation (every action uses `getUser`) — the new code follows the codebase norm, not introduced here. Flagged because the bell adds `getUser()` round-trips per interaction.
- **Fix**: Out of scope for S-06 — a separate cleanup would switch `requireUser()` (and all callers) to `getSession()`; do it repo-wide, not here.
- **Decision**: DEFERRED — see follow-ups/review-fixes.md

### F5 — getFailedShares runs on every authenticated render

- **Severity**: 🟡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/(authenticated)/layout.tsx:14
- **Detail**: The layout runs the failed-shares query (1–2 DB round-trips) on every authenticated route, including `/recipes/[slug]`. Bounded + per-user (MVP); already scoped to skip the recipes lookup when there are no failures. Acceptable MVP tradeoff, inherent to a global header bell.
- **Fix**: None — accept for MVP; revisit if non-recipes authenticated routes appear.
- **Decision**: ACCEPTED (MVP tradeoff)
