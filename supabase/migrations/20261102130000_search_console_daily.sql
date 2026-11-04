-- Google Search Console sync — the daily table and the staff read side.
--
-- The Worker cron (syncSearchConsole in src/lib/worker-cron.ts, run from
-- custom-worker.ts) pulls the Search Analytics report for the last few days once a
-- day and upserts it here: one row per (day, dimension, key), where dimension is
-- 'query' (the search phrase) or 'page' (the site path, e.g. /przepis/sernik). Only
-- the top rows per day are kept, and rows older than 400 days are deleted by the same
-- job. These are Google's own aggregates: no visitor data of any kind.
--
-- Writes: service_role only (the cron). Reads: admin_search_summary_as(actor, days),
-- gated by analytics.read like admin_usage_summary, plus the auth.uid() wrapper for the
-- panel.
--
-- Applied only with the owner's explicit go (local development points at the
-- production database). Additive; rollback at the bottom.
--
-- Idempotent: safe to re-run.

create table if not exists public.search_console_daily (
  day date not null,
  dimension text not null check (dimension in ('query', 'page')),
  key text not null check (char_length(key) between 1 and 500),
  clicks integer not null default 0 check (clicks >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  -- Google's average position for the row; weighted by impressions when summed.
  position real not null default 0 check (position >= 0),
  primary key (day, dimension, key)
);

-- The read filters by day only; the PK leads with day, so a window is a range scan.
-- The prune deletes by day too.

alter table public.search_console_daily enable row level security;

-- No policy: the API roles see nothing; the cron writes with the service key.
revoke all on public.search_console_daily from anon, authenticated;
grant select, insert, update, delete on public.search_console_daily to service_role;

create or replace function public.admin_search_summary_as(p_actor uuid, p_days integer default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(1, least(coalesce(p_days, 28), 366));
  since date;
begin
  if not public.staff_can(p_actor, 'analytics.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  since := (now() at time zone 'Europe/Warsaw')::date - (n - 1);

  -- One pass over the window: each (dimension, key) summed and ranked within its
  -- dimension, so both lists share one position formula and one ordering.
  return (
    with top as (
      select dimension, key,
             sum(clicks)::bigint as clicks,
             sum(impressions)::bigint as impressions,
             round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) as position,
             row_number() over (partition by dimension order by sum(clicks) desc, sum(impressions) desc, key) as rank
      from public.search_console_daily
      where day >= since
      group by dimension, key
    )
    select jsonb_build_object(
      'days', n,
      'since', since,
      'last_day', (select max(day) from public.search_console_daily),
      'queries', coalesce((
        select jsonb_agg(jsonb_build_object('query', t.key, 'clicks', t.clicks, 'impressions', t.impressions, 'position', t.position)
                         order by t.rank)
        from top t
        where t.dimension = 'query' and t.rank <= 50
      ), '[]'::jsonb),
      'pages', coalesce((
        select jsonb_agg(jsonb_build_object('path', t.key, 'title', r.title, 'clicks', t.clicks, 'impressions', t.impressions, 'position', t.position)
                         order by t.rank)
        from top t
        -- Match on the slug column (indexed) rather than building '/przepis/' || slug per recipe.
        left join public.public_recipes r on t.key like '/przepis/%' and r.slug = substr(t.key, 10)
        where t.dimension = 'page' and t.rank <= 50
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.admin_search_summary(p_days integer default 28)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_search_summary_as(auth.uid(), p_days)
$$;

revoke all on function public.admin_search_summary_as(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_search_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_search_summary_as(uuid, integer) to service_role;
grant execute on function public.admin_search_summary(integer) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_search_console_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if has_table_privilege('anon', 'public.search_console_daily', 'select')
     or has_table_privilege('authenticated', 'public.search_console_daily', 'select') then
    raise exception 'search console grant check: an API role can read search_console_daily';
  end if;
  if has_function_privilege('anon', 'public.admin_search_summary_as(uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_search_summary_as(uuid,integer)', 'execute') then
    raise exception 'search console grant check: admin_search_summary_as is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_search_summary(integer)', 'execute') then
    raise exception 'search console grant check: anon can execute admin_search_summary';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_search_summary(integer)', 'execute') then
    raise exception 'search console grant check: authenticated cannot execute admin_search_summary';
  end if;
end;
$$;

revoke all on function public.assert_search_console_grants() from public, anon, authenticated;

select public.assert_search_console_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_search_console_grants(), public.admin_search_summary(integer), public.admin_search_summary_as(uuid, integer);
-- drop table public.search_console_daily;
