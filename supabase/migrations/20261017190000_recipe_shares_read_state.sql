-- E01-S15 — Notifications (screen 5): read state for ready recipes.
-- Spec: .ai/specs/2026-10-17-e01-s15-notifications.md
--
-- The header count is "problems + unread ready recipes" (design handoff §5).
-- A completed share is unread until its recipe is opened from /powiadomienia
-- (read_at), and "Usuń przeczytane" hides read ones (cleared_at). Completed
-- rows are never deleted: the S03a merge rollback restores shares from them.
--
-- No new policy: recipe_shares_owner_update (owner only, 20261017140000)
-- already lets the owner set both columns, and recipe_shares_owner_select keeps
-- them owner-only to read. The pipeline is unchanged — a completed row starts
-- with read_at = null, i.e. unread.
--
-- Deploy order: apply this BEFORE the app build that reads the columns. The
-- current app never names them, so it runs unchanged on the new schema; the
-- new app without them shows /powiadomienia's error state.
--
-- Idempotent: safe to re-run (re-running after the new app ships only marks
-- the ready recipes unread at that moment as read). The backfill fires the
-- recipe_shares updated_at trigger; nothing reads that column.
--
-- Rollback:
--   drop index if exists public.idx_recipe_shares_user_unread;
--   alter table public.recipe_shares drop column if exists cleared_at, drop column if exists read_at;

alter table public.recipe_shares
  add column if not exists read_at timestamptz,
  add column if not exists cleared_at timestamptz;

comment on column public.recipe_shares.read_at is
  'When the owner opened the ready recipe from notifications; null = unread (E01-S15).';
comment on column public.recipe_shares.cleared_at is
  'When the owner removed the read notification ("Usuń przeczytane"); the row is kept (E01-S15).';

-- Shares completed before this feature count as read, so nobody gets a burst
-- of old "Nowe" items on deploy.
update public.recipe_shares
   set read_at = coalesce(updated_at, created_at)
 where status = 'completed'
   and read_at is null;

-- Backs the per-page unread count (head-only count, user + 14-day window).
create index if not exists idx_recipe_shares_user_unread
  on public.recipe_shares (user_id, created_at desc)
  where status = 'completed' and read_at is null and cleared_at is null;
