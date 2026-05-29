---
bootstrapped_at: 2026-05-28T19:19:53Z
starter_id: next
starter_name: Next.js
project_name: zapiszprzepis
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Source: `context/foundation/tech-stack.md`

```yaml
starter_id: next
package_manager: npm
project_name: zapiszprzepis
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: true
```

### Why this stack

Solo developer building a PWA recipe archive in 4 weeks after hours, with auth + AI extraction + background URL processing (1–3 min p95) for a single non-technical user (the author's mum). Next.js wins on three load-bearing factors: largest training-data corpus in the JS family (critical because the user is new to App Router and will lean on agents and docs), verified bootstrapper confidence, and native Vercel Hobby deployment that takes DevOps off the critical path. Background jobs deliberately offloaded to Trigger.dev rather than Vercel cron — keeps long-running scraping/transcription/LLM steps off the request path. Supabase (Postgres + auth + storage) handles magic-link auth (FR-001), persistent recipe + media storage with ≥5y durability (FR-006), and ILIKE/pg_trgm text search (FR-013) without extra infra. Custom path because the user explicitly preferred React over the recommended Astro default; the rest of the application stack (Firecrawl, Playwright, FFmpeg, OpenAI, next-pwa for Web Share Target) is layered on top of the starter rather than scaffolded by it. Self-check flagged "new to Next.js" — bootstrapper should harden CLAUDE.md/AGENTS.md with App Router conventions.

## Pre-scaffold verification

| Signal      | Value                                          | Severity | Notes                                                                       |
| ----------- | ---------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| npm package | create-next-app v16.2.6 published 2026-05-28   | fresh    | resolved from cmd_template                                                  |
| GitHub repo | not run                                        | n/a      | card.docs_url is https://nextjs.org/docs — not a GitHub URL; check skipped  |

## Scaffold log

**Resolved invocation**: `npx --yes create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`

**Strategy**: subdir-then-move

**Exit code**: 0

**Files moved**: 15 (`.git`, `.gitignore`, `.next`, `AGENTS.md`, `README.md`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts`, `node_modules`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `public`, `src`, `tsconfig.json`)

**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold` (pre-existing `CLAUDE.md` preserved; scaffold's 11-byte template sidelined as `.scaffold` sibling)

**.gitignore handling**: moved silently (cwd had no `.gitignore`)

**.bootstrap-scaffold cleanup**: deleted

**Deviation note**: The reference spec calls for the temp directory to be named `.bootstrap-scaffold` (with leading dot). `create-next-app` rejected this name with the error *"name cannot start with a period"* (npm package-naming restriction). Adapted to use `bootstrap-scaffold` (no leading dot). Mechanics of the conflict matrix and move-up step are unchanged.

**Side effects of the CLI worth flagging**:
- The starter ran `git init` itself and committed an initial state. The cwd now carries a `.git/` directory the user did not create. The bootstrapper does not run `git init`, but the CLI's auto-init landed in cwd via the move-up. If the user wants a different repo origin, run `rm -rf .git && git init` before the first commit.
- The starter created an `AGENTS.md` (new default in `create-next-app` v16.x, `--agents-md` flag implicit). The reference spec defers `AGENTS.md` generation to the future M1L4 skill; the starter's version has landed for now and the user may overwrite or augment it later.
- The CLI's own dependency install printed *"2 moderate severity vulnerabilities"* — those are the same findings surfaced by the audit step below.

## Post-scaffold audit

**Tool**: `npm audit --json`

**Summary**: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW

**Direct vs transitive**: 0/0/1/0 direct of total 0/0/2/0 (1 of the 2 moderate findings is on a direct dependency; the other is transitive)

**Tree size**: 431 total dependencies (15 prod, 379 dev, 85 optional, 13 peer)

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

**next** (direct dependency, range `9.3.4-canary.0 - 16.3.0-canary.5`)
- Affected by the postcss advisory below (chained via `via: ["postcss"]`).
- `fixAvailable`: `next@9.3.3` — flagged as `isSemVerMajor: true` (downgrade to a pre-App-Router release; not a viable fix for this project). Effective action: wait for an upstream Next patch that bumps the nested postcss, or override via package manifest if the risk profile demands it.
- Location: `node_modules/next`.

**postcss** (transitive, via `next`, range `<8.5.10`)
- Advisory id: GHSA-qx2v-qp2m-jg93 — *"PostCSS has XSS via Unescaped </style> in its CSS Stringify Output"* (CWE-79).
- CVSS 3.1: 6.1 — `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N`.
- `fixAvailable` chain points to the same `next@9.3.3` major downgrade.
- Location: `node_modules/next/node_modules/postcss`.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                      | Value                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| bootstrapper_confidence   | verified                                                                                           |
| quality_override          | false                                                                                              |
| path_taken                | custom                                                                                             |
| self_check_answers        | typed: true, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: false |
| team_size                 | solo                                                                                               |
| deployment_target         | vercel                                                                                             |
| ci_provider               | github-actions                                                                                     |
| ci_default_flow           | auto-deploy-on-merge                                                                               |
| has_auth                  | true                                                                                               |
| has_payments              | false                                                                                              |
| has_realtime              | false                                                                                              |
| has_ai                    | true                                                                                               |
| has_background_jobs       | true                                                                                               |

`self_check_answers.can_judge_agent: false` is the load-bearing hint for downstream work — the user has signalled they are new to Next.js App Router, so a future M1L4 step should harden `CLAUDE.md`/`AGENTS.md` with App Router conventions, client/server boundary rules, and Server Action patterns.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- The starter ran `git init` itself. If you want a fresh history under your own initial commit, `rm -rf .git && git init` before the first commit.
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` and decide whether to merge anything from the starter template (the starter's version is 11 bytes — likely a placeholder).
- The starter also wrote its own `AGENTS.md`; replace or augment as needed when the M1L4 skill (or you) configures agent context.
- Address the 2 MODERATE audit findings per your project's risk tolerance — both chain through a nested `postcss` inside `next`, and the only `fixAvailable` is a Next major downgrade. Practical option: monitor upstream and re-run `npm audit` after the next `next` patch release.
- Layer on the rest of the planned stack (Supabase, Firecrawl, Playwright, FFmpeg, OpenAI, next-pwa, Trigger.dev) per the `## Why this stack` paragraph above — those were intentionally not scaffolded by the starter.
