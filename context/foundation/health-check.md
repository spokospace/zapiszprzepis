---
project: zapiszprzepis
checked_at: 2026-07-04T20:58:00Z
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 6
  moderate: 7
  low: 4
test_runner_detected: true
ci_provider: null
recommended_fixes: 5
---

## Dependency Health

### Lockfile

```
Status:          present (pnpm-lock.yaml)
Package manager: pnpm@10.23.0
```

### Security Audit

```
Tool:    pnpm audit
Summary: 0 CRITICAL, 6 HIGH, 7 MODERATE, 4 LOW (17 total)
Direct vs transitive: all HIGH and MODERATE findings are in transitive deps
```

#### HIGH findings

All six HIGH findings are in **transitive/dev-tooling** paths — none in first-party application code. Runtime exposure is lower than the severity label suggests, but they should still be addressed.

- **undici** (×3) — TLS certificate validation bypass, WebSocket DoS via fragment count bypass, cross-origin request routing via SOCKS5 proxy pool reuse.
  Path: `wrangler > miniflare > undici`. Fix: upgrade `wrangler` from `4.96.0` to `^4.107.0` (`pnpm update wrangler`).

- **serialize-javascript** — RCE via `RegExp.flags` and `Date.prototype.toISOString()`.
  Path: `next-pwa > workbox-webpack-plugin > workbox-build > rollup-plugin-terser`. `next-pwa` is unmaintained — no patch available in that chain. Fix: evaluate replacing `next-pwa` with `@ducanh2912/next-pwa` (actively maintained fork) or Next.js 15's built-in `metadata.manifest` approach.

- **form-data** — CRLF injection via unescaped multipart field names.
  Path: `@opennextjs/cloudflare > cloudflare > @types/node-fetch`. Fix: upgrade `@opennextjs/cloudflare` from `1.19.11` to `^1.20.1` (`pnpm update @opennextjs/cloudflare`).

- **ws** — Memory exhaustion DoS from tiny fragments.
  Path: transitive dev dependency. Fix: run `pnpm update` to pull in patched transitive versions.

#### MODERATE findings (logged)

- `postcss` — XSS via unescaped `</style>` (build-time only, not runtime)
- `protobufjs` — schema-derived name shadowing via `inngest > @opentelemetry` chain
- `@opentelemetry/core` — unbounded memory allocation in W3C trace-context header parsing
- `undici` — HTTP header injection (×2, same `wrangler > miniflare` path as HIGH findings)
- `js-yaml` — quadratic-complexity DoS via `eslint > @eslint/eslintrc`

### Outdated Dependencies

```
Packages with major version gaps: 2
```

- **@types/node**: `20.19.41` → `26.1.0` (6 major versions behind — dev dep, type-only, low risk)
- **eslint**: `9.39.4` → `10.6.0` (1 major version behind — dev dep; ESLint 10 is not yet broadly adopted, watch release notes before upgrading)

Minor-only gaps not listed (react, next, supabase, inngest, wrangler, etc. — all within the same major).

---

## Test Suite

```
Test runner:    Vitest 4.1.8
Tests found:    46 tests across 7 files
Test execution: passing (7/7 files, 46/46 tests, ~338 ms)
Configuration:  vitest.config.ts
```

Unit tests cover `src/lib/` pipeline functions. Test files:

- `blogger-feed.test.ts`, `content-quality.test.ts`, `detect-source-type.test.ts`
- `env.test.ts`, `firecrawl.test.ts`, `ingredients.test.ts`, `youtube.test.ts`

E2E layer is also in place:

```
E2E runner:     Playwright 1.60.0
E2E tests:      e2e/add-recipe.spec.ts (1 spec file)
Configuration:  playwright.config.ts (targets localhost:3001, Chromium only, with auth setup)
```

Playwright requires a running dev server (`pnpm dev`) and `.env.local` — it is not runnable in a cold environment without setup.

---

## CI/CD

```
Provider:      not detected
Configuration: not found
```

No `.github/workflows/` directory exists. The `tech-stack.md` notes `ci_provider: github-actions` as the intended provider, but no pipeline has been configured yet.

| Stage      | Status | Notes                                   |
|------------|--------|-----------------------------------------|
| Lint       | ✗      | Not in CI (ESLint configured locally)   |
| Test       | ✗      | Not in CI (Vitest runs locally)         |
| Build      | ✗      | Not in CI                               |
| Type check | ✗      | Not in CI (tsc configured locally)      |
| Security   | ✗      | Not in CI                               |

ℹ No CI/CD configuration detected. You'll set this up in the infrastructure and deployment lesson ([Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy — M1L5](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)).
For now, the local Vitest suite is sufficient for agent collaboration — 46 tests passing give the agent clear feedback on regressions.

---

## Configuration

### High severity

_(none)_

TypeScript `strict: true` is enabled. ESLint is configured (`eslint.config.mjs`, Next.js core-web-vitals + typescript presets). Both are solid.

### Medium severity

- **No Prettier / formatter** — ESLint enforces correctness but not code style. Agent-generated code will have inconsistent spacing, quote styles, and trailing commas. Fix: `pnpm add -D prettier eslint-config-prettier` + create `.prettierrc` with `{"semi": false, "singleQuote": true}` and add `"format": "prettier --write ."` to `package.json` scripts. Effort: quick (< 5 min).

### Low severity

- **No `.editorconfig`** — Editors outside VS Code may use different indentation defaults. Fix: create `.editorconfig` with `indent_style = space`, `indent_size = 2`, `end_of_line = lf`. Effort: quick (< 5 min).

### Present and correct

- `.gitignore` ✓
- `.env.local.example` ✓ (documents the two required Supabase env vars)
- `tsconfig.json` with `strict: true` ✓
- `eslint.config.mjs` ✓
- `CLAUDE.md` ✓

---

## Stack Assessment Cross-Reference

```
No stack-assessment.md found. Run /10x-stack-assess for quality-gate analysis.
```

`context/foundation/tech-stack.md` is present and was used as supplementary context. Key notes from it:
- Solo developer, no-prior-Next.js experience → lean on agent tooling (CLAUDE.md already present, good)
- `can_judge_agent: false` — self-assessed as unable to evaluate agent output quality → test coverage becomes especially important as the primary correctness signal

---

## Recommended Fixes

### Fix before agent work (Category A)

#### 1. Upgrade wrangler to resolve 3 HIGH undici findings

**Impact**: Three HIGH transitive vulnerabilities (TLS bypass, WebSocket DoS, SOCKS5 routing) all resolve with a single package update.
**Severity**: high
**Effort**: quick (< 5 min)
**Fix**:

```bash
pnpm update wrangler
```

Verify with `pnpm audit` after — expect the 3 undici HIGH findings to disappear.

#### 2. Upgrade @opennextjs/cloudflare to resolve HIGH form-data finding

**Impact**: CRLF injection in form-data transitive dep resolves with a minor bump.
**Severity**: high
**Effort**: quick (< 5 min)
**Fix**:

```bash
pnpm update @opennextjs/cloudflare
```

#### 3. Evaluate next-pwa replacement (serialize-javascript HIGH, no upstream fix)

**Impact**: `next-pwa` is unmaintained. The RCE finding in `serialize-javascript` has no fix in the `next-pwa` chain. Affects build-time only (not production runtime), but the package will accumulate more unpatched advisories over time.
**Severity**: high (build-time only)
**Effort**: significant (> 1 hour)
**Fix**:

Option A (drop-in): Replace `next-pwa` with `@ducanh2912/next-pwa` — maintained fork with the same API.
```bash
pnpm remove next-pwa
pnpm add @ducanh2912/next-pwa
```
Update `next.config.js`/`next.config.ts` to import from `@ducanh2912/next-pwa`.

Option B (native): Use Next.js 15 `metadata.manifest` + a custom service worker. More work, no third-party dependency.

Recommend Option A first — validate PWA install still works with `pnpm preview`.

#### 4. Add Prettier for consistent code style

**Impact**: Agent-generated code will use inconsistent formatting (quote style, trailing commas, spacing). Without a formatter, diffs get noisy and human review slows down.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

```bash
pnpm add -D prettier eslint-config-prettier
```

Create `.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

Add to `package.json` scripts:
```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

#### 5. Add .editorconfig for cross-editor consistency

**Impact**: Low — but prevents indentation drift when contributors open files in editors not configured to read `tsconfig.json` or `.prettierrc`.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

Create `.editorconfig`:
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

---

### Addressed in upcoming lessons (Category B)

#### No CI/CD pipeline

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Configure GitHub Actions workflows that run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the Cloudflare deploy pipeline on every push.

#### No AGENTS.md / extended CLAUDE.md

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: Write agent instruction files with project-specific conventions (App Router patterns, Supabase client usage, Inngest job structure) so the agent doesn't need to rediscover them each session.

---

## Summary

```
Health status: needs-attention
```

The project has a solid foundation: TypeScript strict mode enabled, ESLint configured, Vitest running 46 tests green, Playwright e2e wired up, and a pnpm lockfile pinning all dependencies. The main issues are six HIGH transitive vulnerabilities that can be cleared with two `pnpm update` commands plus an evaluation of the unmaintained `next-pwa` package, and missing code formatting tooling that will make agent-generated diffs noisier than necessary.

Next step: clear the two quick wrangler and @opennextjs/cloudflare updates (fixes 1 and 2 above), then decide on the next-pwa replacement strategy (fix 3) — these together will drop the audit from 6 HIGH to 0 HIGH. Add Prettier while you're at it (fix 4, < 5 min). Then proceed to agent onboarding (M1L4) with a clean audit baseline.
