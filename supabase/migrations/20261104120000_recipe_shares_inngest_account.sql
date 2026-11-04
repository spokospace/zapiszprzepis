-- Phase 3 of the second-Inngest-account failover (#580).
--
-- Records which Inngest account accepted a share's recipe/extract event. The
-- throttle watchdog uses it to find shares that were sent to the primary and are
-- still pending past the window, and re-sends those to the secondary. Nullable
-- and additive: existing rows stay null and are never watchdog candidates.
--
-- Rollback: alter table public.recipe_shares drop column if exists inngest_account;
alter table public.recipe_shares
  add column if not exists inngest_account text
  check (inngest_account is null or inngest_account in ('primary', 'secondary'));

-- Serves the watchdog's candidate query (pending + primary, oldest first).
create index if not exists recipe_shares_failover_candidates_idx
  on public.recipe_shares (created_at)
  where status = 'pending' and inngest_account = 'primary';
