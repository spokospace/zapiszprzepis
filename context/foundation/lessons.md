# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Validate redirect / `next=` params against an origin-equality check, not a regex

**Context**: F-01 review, `src/app/auth/callback/route.ts:4,18` — `SAFE_NEXT = /^\/(?!\/)/` correctly blocks `//evil.com` but accepts `/\evil.com` (backslash normalization) and `/%2fevil.com` (URL decoding by `NextResponse.redirect`).

**Problem**: Path-based regex allow-lists for redirect targets are brittle — every browser/server-side normalization step opens a new bypass class.

**Rule**: For any handler that reads a redirect target from user-controlled input (`?next=`, `?redirect_to=`, `?return_url=`, etc.), parse it as `new URL(rawNext, origin)` and require `url.origin === origin`. Reject `\` and `%2f` in the raw value as a second layer. Never trust a regex over a path string.

**Applies to**: Any Route Handler / Server Action / API route that performs `NextResponse.redirect(<user-derived path>)`.

## Use exact-equality Set match for error-code mapping, not `String.includes`

**Context**: F-01 review, `src/app/auth/callback/route.ts:6-12` — `mapAuthError` used `code.includes('expired')` and `code.includes('used')`. A future Supabase Auth release could add `validation_paused`, `unused_factor`, or any code containing those substrings and silently miscategorize the error.

**Problem**: Substring matching against an evolving error-code vocabulary is fragile — every new code is a potential mis-classification waiting to happen.

**Rule**: For mapping error codes from an external API (Supabase, Stripe, OAuth providers, etc.), build a `Set` of known codes per output category and use exact equality. When a new code appears, the default branch fires and you investigate — instead of falling into a wrong bucket.

```ts
const EXPIRED = new Set(['otp_expired', 'flow_state_expired', 'flow_state_not_found'])
if (EXPIRED.has(code)) return 'expired'
```

**Applies to**: Any code that maps external API error codes to internal categories (auth, payments, webhooks, third-party integrations).

## In Server Components downstream of proxy auth, prefer `getSession()` over `getUser()`

**Context**: F-01 review, `src/proxy.ts:5` + `src/app/page.tsx:10` — both call `supabase.auth.getUser()`. Proxy already validated the JWT with a network round-trip (~50-100ms EU); the page-level call duplicates the round-trip on every render.

**Problem**: `auth.getUser()` always hits `${SUPABASE_URL}/auth/v1/user` to re-verify the JWT. When the request has already passed through proxy that did this, a second `getUser()` doubles the latency budget for no security benefit — proxy and page run within the same request, JWT cannot expire between them.

**Rule**: Use `auth.getUser()` ONCE per request — at the trust boundary (proxy/middleware). In Server Components, Server Actions, and Route Handlers that run AFTER the proxy gate, use `auth.getSession()` (reads cookie store, no network) when you only need the user's identity. Reserve `getUser()` for code paths that bypass the proxy matcher (e.g. API endpoints excluded from the matcher).

**Applies to**: Any Next.js + Supabase SSR app that uses proxy.ts / middleware.ts for session refresh. Pattern is identical for any "validate-at-boundary + read-locally-downstream" auth setup.

## `SECURITY DEFINER` on Postgres functions only when the function needs elevated privilege

**Context**: F-01 review, `supabase/migrations/20260529093516_init_auth_helpers.sql:7-15` — `public.current_user_id()` is `SELECT auth.uid()` declared `STABLE SECURITY DEFINER`. The plan claimed SECURITY DEFINER was "Supabase-recommended for STABLE caching" — that conflates two unrelated things.

**Problem**: `STABLE` alone enables PostgreSQL per-query memoization. `SECURITY DEFINER` runs the function with the OWNER's privileges (typically `postgres`), which is overkill for `auth.uid()` reads — `auth.uid()` works for any role because it reads `request.jwt.claims`. The SECURITY DEFINER attribute gives the function unnecessarily broad privileges and turns it into a tiny attack-surface increase (anyone who later adds logic runs it as superuser).

**Rule**: Use `SECURITY DEFINER` only when the function MUST access tables the caller cannot read directly (the classic case: wrapping a privileged-data lookup behind a row-filtered API). For wrappers around `auth.uid()` / `current_setting('request.jwt.claims')` / pure expressions, plain `STABLE` is enough. Always pair `SECURITY DEFINER` with explicit `SET search_path = public` to defang search-path attacks.

**Applies to**: Any Postgres function defined for use in RLS policies or PostgREST endpoints.

## All outbound `fetch` in scripts / health checks must use `AbortSignal.timeout`

**Context**: F-01 review, `scripts/check-auth.ts:14-18` — `fetch(\`\${url}/auth/v1/health\`, { headers: ... })` has no timeout. A hung Supabase endpoint will hang the smoke script forever; top-level `.catch` doesn't fire because a TCP-stuck connection never rejects.

**Problem**: Node's default `fetch` (undici) has no timeout. Smoke scripts that should fail loudly instead hang silently — bad for CI, bad for "is the service up" diagnostics.

**Rule**: Every outbound `fetch` in scripts (not page code) wraps with `AbortSignal.timeout(N)` — usually 5-10s for health checks, 30s for legitimate slow APIs. Wrap the fetch in try/catch and exit 1 with a clear message on timeout. Same pattern for any script that calls external APIs (Supabase admin, Vercel, Cloudflare, OpenAI).

```ts
const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
```

**Applies to**: Anything under `scripts/`, plus any background-job code (Trigger.dev) that makes outbound HTTP calls. NOT a hard rule for in-request Server Actions / Route Handlers — they already have a request-level timeout from the runtime (Vercel 10s, Cloudflare CPU limit).

## Validate required env vars at module load via a single `lib/env.ts`, not `process.env.X!`

**Context**: F-01 review, `src/lib/supabase/server.ts:8-9` and `src/lib/supabase/proxy.ts:11-12` — `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `..._ANON_KEY!`. If env is missing at runtime, the non-null assertion silently passes `undefined` to `createServerClient`, which fails with a cryptic "Invalid URL" deep in `@supabase/ssr`.

**Problem**: Non-null assertion on env vars is a lie to the type system. Production has no guard — first request after a misconfigured deploy throws an unrecognizable error. `check-auth.ts` validates on the CLI but cannot prevent prod misconfigurations.

**Rule**: Centralize required env reads in `src/lib/env.ts` that throws a clear `Missing required env: NEXT_PUBLIC_SUPABASE_URL` at module load. Every other file imports `{ SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'`. Optional vars stay as `process.env.X` with explicit `?? defaultValue`. Apply the same pattern to any new third-party integration (OpenAI key, Trigger.dev token, etc.).

**Applies to**: Every Next.js / Node project. The rule scales: as the env-var count grows, having one place to add validations beats scattering `!` assertions across imports.

## Update Supabase Auth Site URL + Redirect URLs on every deployment URL change

**Context**: Recurring bottleneck observed across two platform iterations:
1. F-01 Vercel deploy (PR #1-#4) — magic-link redirect resolved to `localhost` until manual env-var fix on Vercel + Supabase Site URL update; Phase 5.4 verification slipped multiple times.
2. F-01 Cloudflare Workers deploy (Phase 6 first attempt) — magic-link email contained `http://localhost:3000/?code=...` because Supabase Site URL was still the default and `https://zapiszprzepis.pl/auth/callback` (what the app sent in `emailRedirectTo`) wasn't in Redirect URLs allowlist.

**Problem**: Supabase has TWO config locations that must stay in sync with deployment URLs:
1. **Site URL** (project setting, defaults to `http://localhost:3000`) — used as silent fallback
2. **Redirect URLs** allowlist — per-URL whitelist for `emailRedirectTo`

When `emailRedirectTo` is NOT in the allowlist, Supabase silently falls back to Site URL. The magic-link email then points to a wrong/dead URL. The failure is silent: `signInWithOtp` returns success and only the email content reveals the drift. Looks like an app bug; it's dashboard config drift. The pattern recurs because every deployment URL change (new platform, new domain, new preview environment) reintroduces the gap until the dashboard is updated.

**Rule**: Any deployment plan that introduces a new URL (custom domain, new platform, new preview environment) MUST include a phase that:
1. Adds `<new-url>/auth/callback` to Supabase **Redirect URLs** allowlist
2. Updates **Site URL** to the canonical production URL (if the new deploy is production)

Verify by sending one magic link to a real inbox, copying the link from the email, and confirming it matches the expected URL (not `localhost`, not a stale platform URL). Do this on EVERY deploy URL change, even if "we already updated Supabase once" — the moment a new URL appears the drift returns. This step belongs in the plan's `plan.md` as a named phase or sub-step so it cannot be forgotten.

**Mitigation pattern (optional, makes drift loud)**: In the Server Action that calls `signInWithOtp`, log the exact `emailRedirectTo` value sent right before the call. When a user reports a broken link, the value in logs vs the value in the email tells you immediately whether the issue is app-side (wrong URL constructed) or Supabase-side (allowlist drift). Without this, you grep code for hours before realizing the URL never left the app correctly. Plus partial automated mitigation in this repo: `tests/e2e/auth-magic-link.spec.ts` (run via `pnpm test:e2e`) hits the production magic-link form and asserts the redirect URL — catches catastrophic regressions (Worker deploy, Server Action crash, Supabase unreachable) but cannot distinguish `?sent=1` (success) from `?error=*` (Supabase rejection) without a real test inbox; full allowlist-drift detection still requires manually opening the email and verifying its URL target.

**Applies to**: Any Next.js + Supabase magic-link / OAuth flow. Pattern generalizes to ANY external auth provider with a redirect URL allowlist + a fallback default redirect (Auth0, Clerk, NextAuth providers, Stripe Checkout `success_url` validation, OAuth `redirect_uri` allowlists).
