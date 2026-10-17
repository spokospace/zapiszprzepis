# NOTIFY — E01-S21 Phase 1 (append-only, UTC)

- 2026-10-17T21:05Z — Run start. Spec resolved (`.ai/specs/2026-10-17-e01-s21-dish-versions.md`, PR #297). Slot free. Spec-implementation run. Branch `claude/e01-s21-dish-versions-impl-5712f6` (app-made worktree reused). Scope = Phase 1 only; #298 backfill out of scope.
- 2026-10-17T21:05Z — Decision: no `supabase.types.ts` regen; follow untyped-client + optional-augmentation conventions. Dish columns already on prod via #298; new migration is additive view/index/RPC work.
- 2026-10-17T23:32Z — Checkpoint 1 (after Step 1.5). Steps 1.1–1.5 done: migration+rehearsal, recipe-dish.ts validators + LLM calls, postChatJson export, run-extract wiring, dish-versions.ts render helpers. Full gate GREEN: typecheck clean, lint 0 errors, 1071 tests pass. PR #301 (draft). Next: Step 1.6 recipe-page UI.
