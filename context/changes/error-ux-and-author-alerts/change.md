---
change_id: error-ux-and-author-alerts
title: Error UX — notification bell + author alerts (S-06)
status: impl_reviewed
created: 2026-07-04
updated: 2026-07-04
archived_at: null
---

## Notes

Roadmap S-06 (error-ux-and-author-alerts). Moves failed-extraction handling out of the persistent inline red banner on `/recipes` into a header **notification bell**, and fixes an active production bug where the banner never dismissed and the "Ponów" retry button rendered `action="javascript:throw…"`.

This plan was written **retroactively** (2026-07-04) to document work already shipped directly from conversation, so `/10x-impl-review` has a plan to compare against. Phases 1–2 are done and live on branch `feat/s-06-notification-bell` (PR #91); Phase 3 (author email on permanent failure — FR-012 part 3) is intentionally deferred.

Commits: `9cf4e0a` (bell surface), `4ce7d5c` (/simplify: shared `requireUser`, scoped `getFailedShares`), `ef232b7` (a11y), `4cd59e8` (code-review fixes). See [[local-dev-against-prod]].
