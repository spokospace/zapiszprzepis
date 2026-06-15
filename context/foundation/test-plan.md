# Test Plan

A risk-driven, phased testing strategy for this product. The risk map and
strategy are frozen guidance; §3 is the live rollout state.
To re-derive from scratch, re-run with --refresh.

Last updated: 2026-06-15

## §1 — Strategy

1. **Cost × signal.** Spend testing effort where the product of failure cost and
   failure likelihood is highest. A cheap test that catches a likely, costly
   failure beats an expensive test of an unlikely one.
2. **User concerns are first-class evidence.** What the people who rely on this
   product worry about is real risk data, weighted alongside code churn and
   architecture — not below it.
3. **Risks are scenarios, not code locations.** A risk is a failure the user
   would experience ("a paid order ships twice"), never a file or function. Code
   anchoring is deferred to the per-change research step.

Hot-spot scope used for likelihood weighting: `src/lib`, `src/inngest`,
`src/app/share`, `src/app/(authenticated)/recipes` (last 30 days / 72 commits).

## §2 — Risk Map

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | An archived recipe stops working once the source disappears — image/content is not fully copied into our own storage, so the saved recipe degrades when the blog or post is deleted | High | Medium | PRD Guardrail/NFR (archive-first, ≥5 years); interview Q1 |
| 2 | Extraction "succeeds" but stores junk — Google-Translate boilerplate or an empty page passes the quality gate and is saved as if it were a real recipe | High | High | interview Q2/Q3; hot-spot: `src/lib` (28 commits/30d); recurred repeatedly this build session |
| 3 | A shared URL is silently lost — a share fails before a row / `failed` status is recorded, or the failed-shares dedupe hides it, so the user never learns it dropped | High | Medium | PRD NFR "no shared request is silently lost"; interview Q2; hot-spot: `src/app/share` |
| 4 | Ingredients are mis-parsed — the jsonb shape drifts, sections split wrong, or units are confused, so the render silently drops ingredients or misleads the cook | Medium | Medium | interview Q2/Q4; sectioned-ingredients work this session; hot-spot: `src/app/(authenticated)/recipes` (13 commits/30d) |
| 5 | Wrong source-type / id detection — a link is routed into the wrong extraction path (YouTube treated as blog, blogspot not detected) producing an empty/wrong result or a lost video | Medium | Medium | interview Q4; hot-spot: `src/lib` (28 commits/30d) |
| 6 | Hostile URL / SSRF on asset fetch — archiving an image or feed follows a content-controlled address (localhost, cloud metadata) the server should never reach (abuse / security lens) | Medium | Low | interview Q5; tech-stack constraint (server-side fetch of user-supplied URLs) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context research must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| 1 | After extraction, the stored image points at our storage domain and title/ingredients/steps are materialized in our DB — recipe renders with the source unreachable | "Is archiving actually implemented, or does `image_url` still point at the source?" | Where the image is persisted; whether any content is lazily re-fetched at render | integration | Asserting only that a row exists — not that it survives source deletion |
| 2 | A known-junk fixture is rejected before any recipe row is written; a real fixture passes | "Is the gate signature-based and brittle? Which new junk pattern slips through?" | The exact gate ordering: junk check before persist, for every source path | unit | Testing only the happy path; trusting the gate without a junk fixture |
| 3 | Every failed extraction leaves a user-visible failed share with a working retry; nothing is dropped before a row is written | "Can a share fail before its row/status exists? Does dedupe hide distinct fails?" | The failure→row→panel path and the dedupe/`recipe_id is null` query | e2e | Counting only successful shares; ignoring pre-row failures |
| 4 | Sectioned and flat ingredient fixtures group/render without dropping items; malformed jsonb degrades gracefully | "What happens when the LLM returns a string instead of an array, or omits `name`?" | The render/grouping function's tolerance for shape drift | unit | Testing only well-formed jsonb from one LLM run |
| 5 | Each URL shape resolves to the correct source type and id; misroutes are caught | "Does a near-miss host (subdomain, mobile URL, query params) route correctly?" | The detection/id functions and their option selection per source | unit | Testing one canonical URL per source and assuming the rest follow |
| 6 | A fetch to a private/loopback/metadata address is refused before the request leaves | "Which fetch paths bypass Firecrawl and hit a raw URL directly?" | Which code paths do server-side fetch of a content-derived URL | integration | Assuming Firecrawl covers every path; leaving direct fetches unguarded |

## §3 — Phased Rollout (the live state)

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Pure pipeline functions | Configure vitest and unit-test the cheap, high-signal pure functions: junk gate, source/id detection, ingredient grouping, Firecrawl option builders | 2, 4, 5 | unit | complete | test-pure-pipeline-units |
| 2 | Inngest orchestration | Integration-test step ordering (junk-gate-before-persist, youtube_id gap-fill, force-overwrite) and add a focused SSRF guard test on asset fetch | 2, 3, 6 | integration | not started | |
| 3 | Share → recipe path | Extend the existing Playwright suite: shared URL becomes a row, no share is silently lost, the "Ponów" retry is visible and works | 3 | e2e | not started | |
| 4 | Archive durability | Assert the stored image lives in our storage (not the source domain) and recipe content is fully materialized — survives source deletion | 1 | integration / e2e | not started | |

## §4 — Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router, RSC) | 16.2.6 | Server actions + RSC; deployed on Cloudflare via opennextjs-cloudflare |
| UI | React | 19.2.4 | Client components for interactive surfaces |
| Language | TypeScript | ^5 | |
| Styling | Tailwind CSS | ^4 | |
| Data / Auth | Supabase (`@supabase/supabase-js`) | ^2.106.2 | Postgres + RLS per-user; Storage for archived images |
| Pipeline | Inngest | ^4.5.0 | Extraction pipeline, `retries: 3`; local needs `INNGEST_DEV=1` |
| Scraping | Firecrawl | via HTTP API | Not a direct npm dep; called over its API |
| Extraction LLM | OpenAI gpt-4o-mini | via HTTP API | Not a direct npm dep; EN→PL + metric units |
| Unit test | Vitest | ^4.1.8 | Installed but not yet configured (no vitest config) — Phase 1 wires it |
| E2E test | Playwright (`@playwright/test`) | ^1.60.0 | `playwright.config.ts` + 1 e2e present; Phase 3 extends |

**Stack grounding tools (current session):**
- Docs: not available in current session (no live docs fetch performed for this plan).
- Search: not available in current session.
- Runtime-browser: Playwright + Claude-in-Chrome available — used during the build session to verify on prod; `checked: 2026-06-15`.
- Provider: Supabase (production project) reachable from local dev; `checked: 2026-06-15`.

## §5 — Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| Lint | `next lint` (local + CI) | Required after §3 Phase 1 | Style/regressions; unused imports stripped by formatter |
| Typecheck | `tsc --noEmit` (local + CI) | Required after §3 Phase 1 | jsonb-shape and prop drift (Risk 4), API misuse |
| Unit + integration | Vitest (CI) | Required after §3 Phase 2 | Risks 2, 4, 5, 6 — pure-function and orchestration regressions |
| E2E (critical flows) | Playwright (CI) | Required after §3 Phase 3 | Risks 1, 3 — share→recipe path, no silent loss, archive durability |

Post-edit hook is recommended locally, not a substitute for CI. Multimodal
visual review is selective — at most the recipe page (1 critical screen).

As of §3 Phase 1 (`test-pure-pipeline-units`), the lint, typecheck and unit gates
are locally runnable: `pnpm lint`, `pnpm typecheck`, `pnpm test`. Wiring them as
enforced CI steps is still pending (owned by M1 L5 / M2 L5).

## §6 — Cookbook Patterns

### 6.1 Unit tests
Vitest, configured in `vitest.config.ts` (node env, `@/` → `./src` alias,
`include: src/**/*.test.ts`, excludes `e2e/**`).
- **Location & naming:** colocate `*.test.ts` next to the source under `src/`
  (e.g. `src/lib/firecrawl.test.ts` beside `src/lib/firecrawl.ts`).
- **Scope:** pure functions only — no IO, no mocks. Modules that import
  `src/lib/env.ts` throw on load (`server-only` + top-level `requireEnv`), so
  keep unit tests on the env-free pure surface.
- **Reference test:** `src/lib/firecrawl.test.ts` — one assertion group per
  branch of a pure config builder; copy its shape. For known-buggy behavior that
  is intentionally not fixed yet, write a characterization test commented
  `PINNED:` (see `content-quality.test.ts`, `ingredients.test.ts`).
- **Run:** `pnpm test` (one-shot/CI) or `pnpm test:watch`; `pnpm typecheck`
  (`tsc --noEmit`) is the companion type gate.

### 6.2 Integration tests
TBD — see §3 Phase 2 (how to exercise Inngest step ordering and a guarded fetch
without hitting external services).

### 6.3 E2E tests
TBD — see §3 Phase 3 (extending `playwright.config.ts`; authenticated share→recipe
flow; how the test session signs in).

### 6.4 Archive-durability assertions
TBD — see §3 Phase 4 (how to assert storage ownership and content materialization).

### 6.5 AI-native layer (optional)
Candidate, not a required gate: an extraction-quality eval (does the extracted
recipe faithfully match the source?) and a single multimodal screenshot review of
the recipe page. **When NOT to use:** when a classic unit/integration fixture
already gives a deterministic signal cheaper — AI-native checks are non-deterministic
and pay per run, so reserve them for "is the extracted content actually good?",
which no cheap assertion answers. TBD until Phase 1–4 land.

### 6.6 Per-rollout-phase notes
TBD — each rollout phase's final sub-phase appends its concrete location, naming,
reference test, and run command here.

## §7 — What We Deliberately Don't Test

- **Cross-account RLS isolation (multi-tenant leak).** This is a single trusted
  user MVP (the author's mother). RLS is enabled but a dedicated leak-suite is out
  of scope until a second real user exists. Revisit before any public/multi-user
  launch — a single e2e would then be cheap and high-value.
- **Prompt injection / LLM content poisoning.** The source pages are chosen by the
  trusted user and content is for personal use; the blast radius is one account's
  own recipes. Not worth a test harness at MVP.
- **Frequency-based risk ranking.** The user could not estimate failure frequency
  (interview Q3 = "don't know"); likelihood is derived from code evidence instead,
  not from a usage-frequency model we don't have.
- **Auth flow regression suite (reset-password).** High directory churn was
  configuration, not logic; the user did not flag it as a fear. Covered indirectly
  by the Phase 3 sign-in path, not by a dedicated suite.
- **Multimodal visual review of every page.** Selective only — at most the recipe
  page. Vision-fallback (Computer Use / CUA) is reserved for DOM-inaccessible
  surfaces and is not used here.

## §8 — Freshness Ledger

| Item | Last reviewed / verified | Date |
|---|---|---|
| Risk map (§2) synthesized from PRD + roadmap + interview | created | 2026-06-15 |
| Stack (§4) versions read from package.json | verified | 2026-06-15 |
| Tool `checked:` dates (runtime-browser, provider) | verified | 2026-06-15 |

**Triggers that should prompt `--refresh`:**
- A new top-3 risk surfaces from the roadmap or an archived change.
- Any tool `checked:` date in §4 is older than three months.
- The project's tech stack changes (new framework, DB, or pipeline).
- §7 negative space no longer matches what the team believes (e.g. a second real
  user appears → RLS isolation must move out of negative space).
