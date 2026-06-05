---
change_id: async-job-runner
title: Trigger.dev async job runner (F-01)
status: implementing
created: 2026-06-02
updated: 2026-06-04
archived_at: null
roadmap_id: F-01
---

## Notes

F-01 from roadmap (Trigger.dev): Next.js triggeruje zadanie, Trigger.dev wykonuje poza request-path (Vercel/Workers timeout >60s), odsyła callback. FR-003 (potwierdzenie odebrania < 1s + async 1-3 min), NFR p95 ≤ 3 min. Unblocks: S-01 + wszystkie kolejne source slices.
