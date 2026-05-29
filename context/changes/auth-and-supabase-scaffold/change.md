---
id: auth-and-supabase-scaffold
title: Supabase scaffold + magic-link auth (F-01)
status: implemented
created: 2026-05-28
updated: 2026-05-29
roadmap_id: F-01
prd_refs:
  - FR-001
  - Access Control
unblocks:
  - first-shared-recipe-fb-text
  - async-job-runner
  - pwa-shell-and-share-target
---

## Cel

Bootstrap projektu Supabase z magic-link auth (passwordless), `proxy.ts` w Next.js 16 odświeżający sesję na każdym żądaniu, polskojęzyczny UI logowania, pierwsza migracja zakładająca extensions + helper RLS — gotowy fundament dla S-01 i kolejnych wycinków.

## Linki

- PRD: `context/foundation/prd.md` (FR-001, Access Control)
- Roadmap: `context/foundation/roadmap.md` (F-01)
- Tech-stack: `context/foundation/tech-stack.md`
- Plan: `context/changes/auth-and-supabase-scaffold/plan.md`
- Brief: `context/changes/auth-and-supabase-scaffold/plan-brief.md`
