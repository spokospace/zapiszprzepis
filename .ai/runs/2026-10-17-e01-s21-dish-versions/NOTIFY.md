# NOTIFY — E01-S21 Phase 1 (append-only, UTC)

- 2026-10-17T21:05Z — Run start. Spec resolved (`.ai/specs/2026-10-17-e01-s21-dish-versions.md`, PR #297). Slot free. Spec-implementation run. Branch `claude/e01-s21-dish-versions-impl-5712f6` (app-made worktree reused). Scope = Phase 1 only; #298 backfill out of scope.
- 2026-10-17T21:05Z — Decision: no `supabase.types.ts` regen; follow untyped-client + optional-augmentation conventions. Dish columns already on prod via #298; new migration is additive view/index/RPC work.
