# Inngest Orchestration Integration Tests — Plan Brief

> Full plan: `context/changes/testing-inngest-orchestration/plan.md`

## What and Why

Close three production gaps from the test-plan risk map (Risks 2, 3, 6) and prove each
one is protected. The gaps are small code fixes (≤10 lines each) plus an integration test
suite that exercises the pipeline without an Inngest dev server or real database.

## Starting Point

The `extractRecipe` Inngest function is a single monolithic async body — no `step.run()`
steps. Three concrete gaps found in the current code:

- The output-side junk gate (`isExtractedRecipeUsable`) is unit-tested but NOT wired
  into the pipeline. A recipe with a title and empty ingredients is persisted silently.
- If `inngest.send()` throws in `actions.ts`, the share row stays `pending` forever —
  never `failed`, so the notification bell never shows it.
- `archiveImage()` fetches a content-controlled `og:image` URL with no private-range
  blocklist (SSRF surface).

## Desired End State

- Junk input / empty-recipe LLM output → function throws before any DB write (proven by test).
- `inngest.send()` failure → share row updated to `status: 'failed'` (proven by test).
- Private/loopback/metadata URLs → `archiveImage` returns `null` without fetching (proven by test).
- `pnpm test` covers all three invariants with deterministic Vitest tests.

## Key Decisions

| Decision | Choice | Why | Source |
|---|---|---|---|
| How to test the Inngest function | Extract `runExtractRecipe(event, deps)` to a separate file with injected fetch + supabase | Monolithic body + env.ts imports block Vitest without DI; thin wrapper pattern is clean | Plan |
| Supabase in tests | Mocked fluent chain (vi.fn) | No Docker / local Supabase required; confirms call ordering (the correctness signal needed) | Plan |
| SSRF guard placement | Inside `archiveImage()` — pure `isPrivateUrl()` before the fetch | Protects all callers; exported for direct unit test | Plan |
| Wire output gate | Yes, in this phase (3-line change) | The pure function exists and is tested; leaving it unwired means Risk 2 stays open in prod | Plan |
| Fix send-failure | Yes, in this phase (5-line catch block) | NFR "no share silently lost" is not met until this lands | Plan |

## Scope

**In scope:**
- New file `src/inngest/run-extract-recipe.ts` (extracted pipeline helper)
- `src/inngest/functions.ts` becomes thin wrapper
- `src/app/share/actions.ts` send-failure catch fix
- `src/lib/recipe-image-archive.ts` SSRF guard + `isPrivateUrl` export
- Three new test files (one per risk)
- §6.2 cookbook update in `context/foundation/test-plan.md`

**Out of scope:**
- Inngest dev server or `step.run()` infrastructure
- Real Supabase connection in tests
- E2E Playwright extension (Phase 3 of rollout)
- Fixing the known PINNED miss in `content-quality.test.ts` (long GT passes gate)

## Architecture

```
functions.ts (thin Inngest wrapper)
  └── runExtractRecipe(event, deps: { fetch, supabase })   ← new file, testable
        ├── looksUnextractable(markdown) → throw before OpenAI  (already wired)
        ├── isExtractedRecipeUsable(recipeJSON) → throw before DB write  ← NEW
        └── supabase.from('recipes').insert / update / gap-fill

actions.ts
  ├── supabase.from('recipe_shares').insert  ← row always created first (correct)
  └── inngest.send() → catch → mark 'failed'  ← NEW

archiveImage(externalUrl)
  └── isPrivateUrl(externalUrl) → return null early  ← NEW
```

## Phases at a Glance

| Phase | Delivers | Key Risk |
|---|---|---|
| 1. Production hardening | Extracted helper + output gate + send-failure fix + SSRF guard | Refactor must not break the end-to-end extraction flow |
| 2. Integration tests | 3 new test files, all three risks proven green | Supabase fluent mock must faithfully represent the builder chain |
| 3. Cookbook update | §6.2 filled in with patterns, paths, run command | Doc only — no code risk |

**Prerequisites:** Phase 1 of rollout (`test-pure-pipeline-units`) complete — Vitest
configured and `content-quality.test.ts` green. ✓  
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks and Assumptions

- The `makeSupabaseMock()` fluent chain helper is hand-rolled — if Supabase adds a new
  chaining method used in the pipeline, the mock needs updating.
- IPv6 variant addresses (e.g. `[::ffff:169.254.169.254]`) are not blocked by a hostname
  string check alone — document as a known gap in the SSRF test file.

## Success Criteria

- `pnpm test` passes with all new integration tests included (no skips).
- `pnpm typecheck` and `pnpm lint` produce zero errors.
- A manual end-to-end extraction after Phase 1 confirms no regression.
