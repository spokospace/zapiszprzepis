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

## Write commit messages, PRs, and code reviews in English

**Context**: Any git commit subject/body, GitHub PR title/description, or code-review output (comments, review reports) — regardless of the language of the conversation, PRD, roadmap.md, or plan.md.

**Problem**: On 2026-07-04 PRs #90/#91 were opened with Polish titles/descriptions and a code review was written in Polish to "match the chat"; the user corrected this emphatically (twice). Mixed-language git history and review artifacts are inconsistent with the project's English identifiers and harder for tooling and future contributors.

**Rule**: Always write git commit subjects and bodies, PR titles and descriptions, and code-review output in English — even when the surrounding work (chat, PRD, roadmap.md, plan.md, change.md) is in Polish. Only these Git/review artifacts are forced to English; project docs stay in the user's language.

**Applies to**: implement, impl-review, all

## Każda zmiana dostaje własny dedykowany branch — nigdy nie commituj do brancha worktree

- **Context**: Każda zmiana (change-id) w projekcie, przy otwieraniu i implementacji
- **Problem**: Niezwiązane commity mieszają się w jednym PR — np. zmiany test-plan.md lądują razem z feature commitami w branchu worktree, zaciemniając historię i utrudniając review
- **Rule**: Każda zmiana (change-id) dostaje własny krótko-żyjący branch; nigdy nie commituj do współdzielonego brancha worktree
- **Applies to**: all
