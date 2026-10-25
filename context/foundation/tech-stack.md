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
| Recipe extraction, Polish source | `gpt-4o-mini` (`EXTRACTION_MODEL`, `src/lib/source-language.ts`) | `extractWithLlm` in `src/inngest/run-extract-recipe.ts` | Large input (up to ~60 KB of page text), runs on every share; the cheap model reads Polish recipes well. |
| Recipe extraction, foreign source | `gpt-4.1-mini` (`FOREIGN_EXTRACTION_MODEL`) | same, chosen by `detectSourceLanguage` in `src/lib/source-language.ts` | Translation, US-unit conversion and localization are where gpt-4o-mini failed (#524); foreign sources are well under 1% of recipes, so the higher price barely shows. Must differ from `LABEL_MODEL`: tests tell the calls apart by model. |
| Labelling: title casing, note, meta description, tags | `gpt-4.1` (`LABEL_MODEL`) | `labelRecipe` / `generateMetaDescription` in `src/lib/recipe-labeling.ts` | gpt-4o-mini mis-tagged (bread rolls as "kruche"); the input is one small recipe, so the big model costs little. |
| Dish classification + variant note (E01-S21) | `gpt-4.1` (`LABEL_MODEL`, via `postChatJson`) | `classifyDish` / `writeVariantNote` in `src/lib/recipe-dish.ts` | Same reasoning as labelling. |
| Step rewrite to infinitive form (backfill) | `gpt-4.1` (`LABEL_MODEL`, via `postChatJson`) | `src/lib/step-form.ts` | Same reasoning as labelling. |

Approximate cost per extraction (~15k input + ~1.5k output tokens, OpenAI list prices as last checked 2026-10-25 — re-check before relying on them): gpt-4o-mini ≈ $0.003, gpt-4.1-mini ≈ $0.008, gpt-4.1 ≈ $0.04. No other AI service (DeepL, Whisper, embeddings) is in use; DeepL was considered and rejected in #524 because it translates but does not convert units or localize.
