<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Supabase scaffold + magic-link auth (F-01)

- **Plan**: `context/changes/auth-and-supabase-scaffold/plan.md`
- **Scope**: All 5 phases (post-hoc review)
- **Date**: 2026-05-31
- **Verdict**: NEEDS ATTENTION → resolved via triage
- **Findings**: 0 critical · 5 warnings · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (3 findings) |
| Architecture | PASS (1 observation) |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Open-redirect edge cases in /auth/callback?next=

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/app/auth/callback/route.ts:4,18`
- **Detail**: `SAFE_NEXT = /^\/(?!\/)/` blocks `//evil.com` but accepts `/\evil.com` (backslash) and `/%2fevil.com` (URL-decoded).
- **Fix**: Replace regex check with origin-equality test using URL parsing.
- **Decision**: ACCEPTED-AS-RULE: `redirect-validation-origin-equality` (lessons.md)
- **Note**: Currently unexercised (login action doesn't pass `next`); rule applies to future S-XX flows that might.

### F2 — mapAuthError uses substring matching

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/app/auth/callback/route.ts:6-12`
- **Detail**: `code.includes('expired')` / `code.includes('used')` match unrelated future Supabase codes.
- **Fix**: Use exact-equality `Set` match.
- **Decision**: ACCEPTED-AS-RULE: `error-code-mapping-exact-equality` (lessons.md)

### F3 — getSiteUrl protocol detection misses 127.0.0.1 and LAN IPs

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/lib/site-url.ts:9`
- **Detail**: `host?.startsWith('localhost')` returns 'https' for 127.0.0.1, 192.168.x.x, *.local. Mom's PWA may be reached via LAN IP during author's testing on her device.
- **Fix**: Treat any non-public hostname as HTTP unless `x-forwarded-proto` says otherwise.
- **Decision**: FIXED (commit pending)

### F4 — Double getUser() on every authenticated page request

- **Severity**: WARNING
- **Impact**: HIGH
- **Dimension**: Architecture
- **Location**: `src/proxy.ts:5` + `src/app/page.tsx:10`
- **Detail**: Both call `auth.getUser()` → 2× network round-trip per page render (~100-200ms EU).
- **Fix Option A** (recommended): Swap HomePage's `getUser()` → `getSession()`.
- **Decision**: ACCEPTED-AS-RULE: `getsession-downstream-of-proxy` (lessons.md). Not applied to current code — apply when S-01 adds the first real Server Component beyond placeholder.

### F5 — server.ts setAll swallows Route Handler cookie failures

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/lib/supabase/server.ts:15-23`
- **Detail**: try/catch swallows ALL errors. /auth/callback is a Route Handler where cookie writes ARE allowed; a real failure here drops session silently → user bounces back to /login with no error.
- **Fix**: Narrow catch to the expected "Cookies can only be modified" error; rethrow others.
- **Decision**: FIXED (commit pending)

### F6 — SECURITY DEFINER on public.current_user_id() is unjustified

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Architecture
- **Location**: `supabase/migrations/20260529093516_init_auth_helpers.sql:7-15`
- **Detail**: `STABLE` alone enables Postgres memoization; `SECURITY DEFINER` adds postgres-owner privileges with no benefit. Mitigated by `SET search_path = public`.
- **Decision**: ACCEPTED-AS-RULE: `security-definer-only-when-needed` (lessons.md). Current migration stays as-is (changing it would need a follow-up migration); rule applies to future Postgres functions.

### F7 — supabase/config.toml redirect URL has wrong scheme

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `supabase/config.toml:158`
- **Detail**: `additional_redirect_urls = ["https://127.0.0.1:3000"]` is the unmodified `supabase init` scaffold default. Dead config — plan skips local Docker stack.
- **Decision**: SKIPPED (situational, not a generalizable rule)

### F8 — check-auth.ts fetch has no timeout

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `scripts/check-auth.ts:14-18`
- **Detail**: A hung Supabase endpoint hangs the smoke script forever.
- **Decision**: ACCEPTED-AS-RULE: `fetch-timeout-in-scripts` (lessons.md). Apply when script is next touched.

### F9 — Non-null env assertions in server clients

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/lib/supabase/server.ts:8-9`, `src/lib/supabase/proxy.ts:11-12`
- **Detail**: `process.env.NEXT_PUBLIC_SUPABASE_URL!` produces cryptic "Invalid URL" if missing at runtime.
- **Decision**: ACCEPTED-AS-RULE: `env-validation-centralized` (lessons.md). Apply when adding the next required env var (likely Trigger.dev / OpenAI keys in S-XX).

### F10 — page.tsx placeholder uses visible line instead of source TODO

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/app/page.tsx:33-35`
- **Detail**: Plan said add `// TODO(S-01): lista przepisów zastąpi ten placeholder`. Implementation has a visible Polish placeholder line instead.
- **Decision**: SKIPPED (project-specific UX choice; visible note communicates intent fine for current scope)

## Summary

- **Fixed in code**: F3, F5 (2)
- **Accepted as recurring rule** (`context/foundation/lessons.md`): F1, F2, F4, F6, F8, F9 (6)
- **Skipped**: F7, F10 (2)
