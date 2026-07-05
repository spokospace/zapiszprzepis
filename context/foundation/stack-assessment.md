---
project: "zapiszprzepis"
assessed_at: "2026-07-04"
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript 5
  framework: Next.js 16.2.6 (App Router)
  build_tool: Turbopack + pnpm 10.23.0
  test_runner: Vitest 4 (unit) + Playwright (e2e vs production)
  package_manager: pnpm
  ci_provider: null
  deployment_target: Cloudflare Workers via @opennextjs/cloudflare
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language — TypeScript 5** with `strict: true` in `tsconfig.json`. All source files are `.ts` / `.tsx`; the `typecheck` npm script runs `tsc --noEmit`. The `@/*` alias resolves to `./src/` and is mirrored in `vitest.config.ts`.

**Framework — Next.js 16.2.6 (App Router)**. File-based routing under `src/app/`. Route groups: `(authenticated)/` for gated pages, `(actions)/` for shared server actions. API routes under `src/app/api/`. Auth callbacks, magic-link flows, and the Web Share Target handler are all App Router route handlers. PWA overlay via `next-pwa`.

**Build tool — Turbopack** (enabled in `next.config.ts` via `turbopack: {}`), deployed via `@opennextjs/cloudflare`. The deployment target is Cloudflare Workers (V8 isolate runtime, NOT Node.js). Wrangler config in `wrangler.jsonc`.

**Test runners — Vitest 4 (unit) + Playwright (e2e)**. Unit tests live under `src/**/*.test.ts` and target pure library functions in `src/lib/`. E2E tests live under `e2e/` and run against `https://zapiszprzepis.pl` (production), not localhost — necessary because service worker registration and PWA install require HTTPS and a live environment. No CI/CD pipeline is configured; both suites are run manually.

**Background jobs — Inngest 4** (production-wired: `src/inngest/client.ts`, `src/inngest/functions.ts`, `src/app/api/inngest/route.ts`). Trigger.dev SDK is present in `package.json` but is unused dead code — ignore it.

**Package manager — pnpm 10.23.0** (`pnpm-lock.yaml` present, `packageManager` field in `package.json`).

## Quality Gate Assessment

| Component           | Typed | Convention-based | Popular (JS family) | Documented | Verdict |
|---------------------|:-----:|:----------------:|:-------------------:|:----------:|:-------:|
| Language (TS 5)     |  ✓    |        —         |          —          |     —      |  pass   |
| Framework (Next.js) |  —    |        ✓         |          ✓          |     ✓      |  pass   |
| Build tool (pnpm)   |  —    |        ✓         |          ✓          |     ✓      |  pass   |
| Test runners        |  —    |        —         |          ✓          |     ✓      |  pass   |

### Gate Details

**Typed — PASS.**
Evidence: `tsconfig.json:7` sets `"strict": true`; `package.json` scripts include `"typecheck": "tsc --noEmit"`. All first-party files are `.ts`/`.tsx`. TypeScript compiler is a hard dependency (`typescript: "^5"` in devDependencies).

**Convention-based — PASS.**
Evidence: `next.config.ts` confirms Next.js App Router. Source tree follows the canonical App Router layout: `src/app/` with route groups, co-located `page.tsx`/`layout.tsx`, server actions as `actions.ts` or `*-action.ts` files, API handlers in `src/app/api/`. `src/lib/` holds pure utilities. A stranger reading the tree can predict where things live without opening every file.

**Popular in training data (JS/TS family) — PASS.**
Next.js is the dominant full-stack framework in the JS ecosystem with extensive Stack Overflow and open-source corpus coverage. Vitest and Playwright are the leading modern choices in their categories within the JS/TS family.

**Well-documented — PASS.**
Next.js has versioned official docs (nextjs.org/docs). Vitest docs at vitest.dev. Playwright at playwright.dev. Supabase JS SDK at supabase.com/docs. All main dependencies have current, maintained official documentation.

## Gaps & Compensation

All four gates pass, but three **project-specific runtime constraints** are not visible from the stack alone and will cause agent friction without explicit documentation.

---

### Gap 1 — Cloudflare Workers runtime (not Node.js)

**Why it matters for agent work:** The production runtime is a V8 isolate (Cloudflare Workers), not Node.js. Standard Node.js APIs (`fs`, `path`, `child_process`, `http`, `https`, `net`, `crypto` from Node) are absent or shimmed. An agent writing any server-side code that uses Node.js builtins will produce code that builds locally (`tsc` passes) but fails at runtime on the deployed worker. The Discovery feature's new server action calls the Exa API via `fetch` — this is correct. Any agent adding code to a server action must use `fetch`, not Node.js HTTP clients.

**Compensation — add to CLAUDE.md:**

```markdown
## Runtime — Cloudflare Workers (V8 isolate, not Node.js)

Production runs on Cloudflare Workers. Rules for all server-side code (server actions, API route handlers, middleware):

- HTTP calls: use `fetch()` only — no `node-fetch`, `axios`, `got`, or `https.request`.
- File system: no `fs`, `path`, `child_process`. There is no writable filesystem.
- Crypto: use `crypto.subtle` (Web Crypto API) — `require('crypto')` is not available.
- Environment secrets: read via `process.env.SECRET_NAME` — wired in `wrangler.jsonc` (vars) or Cloudflare dashboard (secrets). Never hard-code secrets.
- Edge compatibility check before adding a dependency: run `wrangler dev` locally and confirm the worker boots without "unenv" or "module not found" errors.
```

---

### Gap 2 — Supabase client selection (three clients, different contexts)

**Why it matters for agent work:** `src/lib/supabase/` contains three distinct clients. Using the wrong one in a given context causes auth failures or leaks server-only tokens to the client. The Discovery feature's dedup check runs inside a server action — it must use the server client.

**Compensation — add to CLAUDE.md:**

```markdown
## Supabase client selection

Three clients exist — pick by context:

| File | Use when |
|------|----------|
| `src/lib/supabase/server.ts` | Server actions, API route handlers, middleware — anywhere that runs on the server and has access to cookies |
| `src/lib/supabase/client.ts` | Client components (`"use client"`) that need Supabase access |
| `src/lib/supabase/proxy.ts` | Cloudflare proxy workaround — do not use directly; it is called internally by the server client |

Rule: new server actions always use `createSupabaseServerClient()` from `server.ts`. Never import the browser client in a server action.
```

---

### Gap 3 — E2E tests run against production, not localhost

**Why it matters for agent work:** `playwright.config.ts` sets `baseURL: 'http://localhost:3001'` but the actual E2E suite is run against `https://zapiszprzepis.pl`. PWA service worker registration requires HTTPS, so local Playwright runs will not reproduce service-worker-dependent behavior. An agent that runs `pnpm test:e2e` locally may see passing tests that would behave differently on the deployed PWA.

Additionally, there is no CI/CD pipeline — quality gates (`typecheck`, `lint`, `test`) are manual. An agent completing an implementation task must run these before reporting done.

**Compensation — add to CLAUDE.md:**

```markdown
## Testing — important constraints

### E2E targets production
Playwright E2E tests (`e2e/`) run against `https://zapiszprzepis.pl`, not localhost.
Reason: PWA service worker registration requires HTTPS and a live origin.
Do not rely on `pnpm test:e2e` locally for service-worker-dependent behavior — deploy first, then verify.

### No CI/CD — run gates manually
There is no automated CI/CD pipeline. Before marking any implementation task complete, run:
```sh
pnpm typecheck   # zero TypeScript errors
pnpm lint        # zero ESLint errors
pnpm test        # all unit tests green
```
E2E verification happens post-deploy against production.
```

---

### Recommended Instruction File Additions

The three blocks above are ready to paste into `CLAUDE.md`. Suggested placement: after the existing commit-message rule, before the `<!-- BEGIN @przeprogramowani/10x-cli -->` block, as a new `## Project runtime rules` section grouping all three entries.

## Summary

**Overall readiness: ready-with-compensation.** All four agent-friendly quality gates pass — TypeScript strict, Next.js App Router conventions, strong training-data representation, excellent documentation. The stack is a solid foundation for agent-driven work.

**Key strengths:**
- TypeScript strict mode enforced at the compiler level — type errors are caught before any agent-written code reaches runtime.
- Next.js App Router provides predictable file-based conventions that an agent can navigate without project-specific guidance.
- Unit test suite (`src/lib/*.test.ts`) covers pure pipeline functions — agent can verify logic changes without deploying.

**Key gaps (all compensable via CLAUDE.md):**
1. Cloudflare Workers runtime — agents must know `fetch`-only HTTP; no Node.js APIs in server code.
2. Supabase client selection — three clients for three contexts; wrong choice causes silent auth failures.
3. E2E against production + no CI — agent must run typecheck/lint/test manually before reporting done.

**Recommended next step:** Add the four `## ...` blocks from the compensation section above to `CLAUDE.md`, then run `/10x-health-check` to audit dependency health, test coverage, and CI/CD gaps.
