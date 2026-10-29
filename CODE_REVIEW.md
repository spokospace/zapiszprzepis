# Code review rules

The review rules for this repository. `om-code-review` (and `om-auto-review-pr`) applies this file on top of its built-in checklist; humans use the same list. Process context lives in `SDLC.md`; protected surfaces in `BACKWARD_COMPATIBILITY.md`; recurring pitfalls in `context/foundation/lessons.md`.

Stack: Next.js 16 App Router (React 19) running on Cloudflare Workers via OpenNext, Supabase (Postgres + Auth + Storage, RLS), Inngest background jobs, a hand-written PWA service worker, Vitest + Playwright.

## Review priorities

1. **Correctness** — the change does what the PR says, on every branch: success, missing/empty input, unauthenticated, duplicate, upstream failure.
2. **Security and data isolation** — no user can read or change another user's recipes or shares; no secret reaches the browser.
3. **Contracts** — nothing in `BACKWARD_COMPATIBILITY.md` breaks without its required path.
4. **Deployability** — the Worker still builds, fits the bundle limit, and the cron and bindings still match.
5. **Quality** — tests, readability, consistency with the surrounding code.

## Repo-specific checks

### Auth, sessions, redirects

- Any `next=` / redirect target goes through `src/lib/safe-redirect.ts` (`safeNext`), never a regex or `startsWith` check (lessons.md #1).
- External error codes (Supabase `error_code`, provider errors) are mapped by exact match against a `Set`, not `includes` (lessons.md #2).
- `getUser()` is called once at the middleware boundary (`src/middleware.ts` → `src/lib/supabase/proxy.ts`); new downstream code uses the session rather than adding another round-trip (lessons.md #3).
- A new public path must be added deliberately to the allow-list in `src/middleware.ts`; anything else is session-gated by default. Flag any route that becomes open by accident.
- Auth email links rely on `RedirectTo` already containing `?next=` (templates append `&token_hash=…`). A change to the redirect URLs built in the auth actions or to `supabase/templates/*.html` must keep that shape, and the PR must say the production templates in the Supabase Dashboard need the same manual edit.

### Supabase and data

- User-facing reads and writes use `createSupabaseServerClient()` / `createSupabaseBrowserClient()` so RLS applies. The service-role client is allowed only in Inngest functions, cron jobs (`src/lib/worker-cron.ts`) and storage writes; when it is used, the query must scope by `user_id` explicitly. Two request-path exceptions exist, both narrow: `findMergedRecipeSlug` (reads a service-only table), and the staff MCP route `src/app/api/mcp/route.ts` (code in `src/lib/staff/mcp/`), which calls only the `admin_*_as` functions plus `staff_resolve_token` and `staff_audit`, named in `src/lib/staff/registry.ts`, and passes the actor id of the bearer token's owner in place of a `user_id` scope. Those functions re-check the permission in SQL, so the route can hide a tool but not widen access. Flag any other use of the service key in a request path, and any MCP code that names a resource or a function not taken from the registry.
- New tables get RLS enabled plus a user-isolation policy in the same migration, matching `recipes_user_isolation`.
- `SECURITY DEFINER` only when elevated privileges are required, always with `SET search_path` (lessons.md #4).
- Migrations are new files named `YYYYMMDDHHMMSS_snake_case.sql`; never edit an applied migration. Remember that local dev points at the **production** database.
- Tags are a closed list in `src/lib/recipe-tags.ts`, enforced by the app (no enum): values coming from the model or the URL are filtered against it.
- Storage objects live under `<user_id>/<recipe_id>/…`; the owner-delete policy relies on the first folder being the user id, so new upload paths must keep it.
- After a schema change, `src/lib/supabase.types.ts` is updated in the same PR.

### Server actions and route handlers

- Inputs come from `FormData` and are untrusted: trim, check emptiness, parse URLs with `new URL()` inside try/catch (`src/lib/url-normalize.ts`), and check the user before doing any work.
- Follow the existing error style: actions `redirect()` with a known query-param code (`?add_error=…`, `?duplicate=…`); route handlers return `NextResponse.json({ error }, { status })`. A new error code needs UI that renders it.
- Modules holding secrets or server logic import `server-only`.

### Environment and outbound calls

- Required env vars are read through `requireEnv` in `src/lib/env.ts`, never `process.env.X!` (lessons.md #6). New secrets are listed in `.env.local.example` and noted in the PR (they must be set as Worker secrets by hand).
- Every outbound `fetch` in background jobs, cron and scripts has `AbortSignal.timeout(...)` (lessons.md #5).
- Do not add Node-only or heavy dependencies to code that ends up in the Worker without checking the bundle size.

### Cloudflare Worker and deploy

- **Do not rename `src/middleware.ts` to `proxy.ts`.** Next 16's `proxy.ts` forces the Node runtime and grew the Worker from ~356 KB to ~4.6 MB, over the 3 MiB free-tier limit; every Workers Build after #119 failed. See the header comment in `src/middleware.ts`.
- Cron expressions live in `wrangler.jsonc` **and** are matched as exact strings in `custom-worker.ts`; a change to one without the other silently disables the job.
- New bindings (R2, KV, …) must exist in the Cloudflare account before merge, since merging to `master` deploys via Workers Builds.

### Background extraction (Inngest)

- `extract-recipe` retries 3 times: steps must be idempotent (no duplicate recipe rows, no double image upload). Dedup goes through `src/lib/recipe-dedup.ts`.
- Failure messages written to `recipe_shares.error_message` are shown to users verbatim, so they are Polish, human-readable, and contain no stack traces or upstream secrets.
- Source-specific extraction belongs in its extractor module (`src/lib/youtube.ts`, `facebook.ts`, `blogger-feed.ts`, `firecrawl.ts`) with a test next to it; `detect-source-type.ts` routes to it.

### PWA

- `public/sw.js` versions its caches per build through the `?v=` on its registration URL (`serviceWorkerUrl` in `src/lib/pwa-utils.ts`) — keep it that way rather than hard-coding a version. It must never intercept non-GET requests (Server Actions, `/share`, `/api`) or RSC requests, and must never cache signed-in pages: only routes `isPublicRoute` allows are cached (`src/lib/sw.test.ts` keeps the two in sync).
- `public/manifest.json` `share_target` must keep matching the `/share` POST handler's field names (`title`, `text`, `url`).

### Next.js 16 and React 19

- Next 16 APIs differ from older training data: check `node_modules/next/dist/docs/` before accepting an unfamiliar pattern (see `AGENTS.md`).

### Tests

- Logic in `src/lib` and `src/inngest` ships with a Vitest test next to it (`*.test.ts`). A bug fix comes with a regression test that fails without the fix.
- Playwright specs live in `e2e/`; add one only for flows that need a real browser.

### Language

- Code, comments, commits, PR text and `.md` files are in English (`CLAUDE.md`, lessons.md #7, #10). User-facing UI strings stay Polish.

## Validation gate

`pnpm typecheck` → `pnpm lint` → `pnpm test`. There is no hosted CI, so the reviewer relies on this gate having been run locally; a missing GitHub check means nothing.

## Severity

- **Blocker** — data leak across users, auth bypass, secret exposure, a broken contract from `BACKWARD_COMPATIBILITY.md` without its required path, a change that breaks the Worker build or bundle limit, a failing gate.
- **Major** — wrong behaviour on a realistic path, missing RLS or user scoping, a non-idempotent Inngest step, a missing regression test for a bug fix, an unhandled upstream failure.
- **Minor** — style drift from the surrounding code, an unclear name, a missing edge-case test with low blast radius.
- **Nit** — taste; never blocks.

Blockers and majors produce `changes-requested`. Minors and nits may be approved with comments, or turned into follow-up issues.
