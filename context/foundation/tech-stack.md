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
