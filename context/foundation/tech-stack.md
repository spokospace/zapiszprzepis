---
starter_id: next
package_manager: pnpm
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
---

## Why this stack

Solo developer building a PWA recipe archive in 4 weeks after hours, with auth + AI extraction + background URL processing (1–3 min p95) for a single non-technical user (the author's mum). Next.js wins on three load-bearing factors: largest training-data corpus in the JS family (critical because the user is new to App Router and will lean on agents and docs), verified bootstrapper confidence, and native Vercel Hobby deployment that takes DevOps off the critical path. Background jobs deliberately offloaded to Trigger.dev rather than Vercel cron — keeps long-running scraping/transcription/LLM steps off the request path. Supabase (Postgres + auth + storage) handles magic-link auth (FR-001), persistent recipe + media storage with ≥5y durability (FR-006), and ILIKE/pg_trgm text search (FR-013) without extra infra. Custom path because the user explicitly preferred React over the recommended Astro default; the rest of the application stack (Firecrawl, Playwright, FFmpeg, OpenAI, next-pwa for Web Share Target) is layered on top of the starter rather than scaffolded by it. Self-check flagged "new to Next.js" — bootstrapper should harden CLAUDE.md/AGENTS.md with App Router conventions.

## AI models (OpenAI)

Every LLM call goes to the OpenAI Chat Completions API with `OPENAI_API_KEY`, in JSON mode. Two code paths pick the model; change a model there, and update this table in the same PR.

| Call | Model | Where | Why this model |
|---|---|---|---|
| Recipe extraction, Polish source | `gpt-5.4-mini` (`EXTRACTION_MODEL`, `src/lib/source-language.ts`) | `extractWithLlm` in `src/inngest/run-extract-recipe.ts` | Large input (up to ~60 KB of page text), runs on every share. Chosen over `gpt-4o-mini` in the #526 eval (26 recipes, 5 models × 2 runs): ~half the raw `alt` rule violations the #525 guard patches (23 vs 48), near-zero step-form violations (1 vs 83), and the fastest (p95 ~6 s vs ~13 s). Runs at default reasoning effort `none`, so the request stays `temperature: 0.3` + JSON mode (the gpt-5 mini/nano tiers reject `temperature`). Full numbers: `context/foundation/extraction-model-eval-2026-10.md`. |
| Recipe extraction, foreign source | `gpt-5.4-mini` (`FOREIGN_EXTRACTION_MODEL`, same as the Polish path since the 2026-10-28 foreign eval) | same, chosen by `detectSourceLanguage` in `src/lib/source-language.ts` | Translation and localization are where gpt-4o-mini failed (#524); US units the model leaves in a step are converted in code (`src/lib/us-units.ts`). Must differ from `LABEL_MODEL`: tests tell the calls apart by model. |
| Labelling: title casing, note, meta description, tags | `gpt-4.1` (`LABEL_MODEL`) | `labelRecipe` / `generateMetaDescription` in `src/lib/recipe-labeling.ts` | gpt-4o-mini mis-tagged (bread rolls as "kruche"); the input is one small recipe, so the big model costs little. |
| Dish classification + variant note (E01-S21) | `gpt-4.1` (`LABEL_MODEL`, via `postChatJson`) | `classifyDish` / `writeVariantNote` in `src/lib/recipe-dish.ts` | Same reasoning as labelling. |
| Step rewrite to infinitive form (backfill) | `gpt-4.1` (`LABEL_MODEL`, via `postChatJson`) | `src/lib/step-form.ts` | Same reasoning as labelling. |

Approximate cost per extraction (~10k input + ~0.9k output tokens measured in the #526 eval, OpenAI list prices as last checked 2026-10-25 — re-check before relying on them): gpt-4o-mini ≈ $0.002, gpt-5.4-mini ≈ $0.012, gpt-4.1-mini ≈ $0.006, gpt-4.1 ≈ $0.04. At a few dozen extractions a month the Polish-source upgrade to gpt-5.4-mini costs cents. `FOREIGN_EXTRACTION_MODEL` followed on 2026-10-28 after the foreign-source eval (see the #526 note). No other AI service (DeepL, Whisper, embeddings) is in use; DeepL was considered and rejected in #524 because it translates but does not convert units or localize.
