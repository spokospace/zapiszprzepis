-- External API limits — provider snapshots (phase 2 of the API usage tab) and the
-- Inngest counter.
--
-- A daily Worker cron (syncApiLimits in src/lib/worker-cron.ts, run from
-- custom-worker.ts) asks each provider that exposes it how much of its plan is left and
-- upserts one row per service here. Today that is Firecrawl (team credit usage); OpenAI,
-- Jina and Inngest publish no balance endpoint a plain API key can read, so they have no
-- row and the admin screen shows only our own counter for them.
--
-- Also widens api_usage_daily.service to 'inngest', so the extraction job can count its
-- own runs (Inngest's plan is metered in runs and steps).
--
-- Writes: service_role only (the cron). Reads: admin_api_limits_as(actor), gated by
-- analytics.read like admin_api_usage, plus the auth.uid() wrapper for the panel.
--
-- Applied by hand to production (local development points at the production database).
-- Additive; rollback at the bottom. Idempotent: safe to re-run.
-- Depends on 20261104100000_api_usage_daily.sql.

alter table public.api_usage_daily drop constraint if exists api_usage_daily_service_check;
alter table public.api_usage_daily
  add constraint api_usage_daily_service_check check (service in ('openai', 'firecrawl', 'jina', 'inngest'));

create table if not exists public.api_limit_snapshots (
  service text primary key check (char_length(service) between 1 and 40),
  -- What is left and what the plan holds, in `unit` (credits, tokens, runs).
  remaining numeric not null check (remaining >= 0),
  total numeric not null check (total >= 0),
  unit text not null check (char_length(unit) between 1 and 20),
  -- End of the current billing period when the provider says so.
  period_end timestamptz,
  fetched_at timestamptz not null default now()
);

alter table public.api_limit_snapshots enable row level security;

-- No policy: the API roles see nothing; the cron writes with the service key.
revoke all on public.api_limit_snapshots from anon, authenticated;
grant select, insert, update, delete on public.api_limit_snapshots to service_role;

create or replace function public.admin_api_limits_as(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.staff_can(p_actor, 'analytics.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'service', service, 'remaining', remaining, 'total', total, 'unit', unit,
             'period_end', period_end, 'fetched_at', fetched_at)
           order by service)
    from public.api_limit_snapshots
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_api_limits()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_api_limits_as(auth.uid())
$$;

revoke all on function public.admin_api_limits_as(uuid) from public, anon, authenticated;
revoke all on function public.admin_api_limits() from public, anon, authenticated;
grant execute on function public.admin_api_limits_as(uuid) to service_role;
grant execute on function public.admin_api_limits() to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_api_limits_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if has_table_privilege('anon', 'public.api_limit_snapshots', 'select')
     or has_table_privilege('authenticated', 'public.api_limit_snapshots', 'select') then
    raise exception 'api limits grant check: an API role can read api_limit_snapshots';
  end if;
  if has_function_privilege('anon', 'public.admin_api_limits_as(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_api_limits_as(uuid)', 'execute') then
    raise exception 'api limits grant check: admin_api_limits_as is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_api_limits()', 'execute') then
    raise exception 'api limits grant check: anon can execute admin_api_limits';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_api_limits()', 'execute') then
    raise exception 'api limits grant check: authenticated cannot execute admin_api_limits';
  end if;
end;
$$;

revoke all on function public.assert_api_limits_grants() from public, anon, authenticated;

select public.assert_api_limits_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_api_limits_grants(), public.admin_api_limits(), public.admin_api_limits_as(uuid);
-- drop table public.api_limit_snapshots;
-- delete from public.api_usage_daily where service = 'inngest';
-- alter table public.api_usage_daily drop constraint api_usage_daily_service_check;
-- alter table public.api_usage_daily
--   add constraint api_usage_daily_service_check check (service in ('openai', 'firecrawl', 'jina'));
