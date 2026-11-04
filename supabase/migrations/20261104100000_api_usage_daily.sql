-- External API usage counter — the daily table, the write RPC and the staff read side.
--
-- The extraction pipeline (src/inngest/run-extract-recipe.ts, src/lib/jina-reader.ts)
-- calls record_api_usage() after each OpenAI / Firecrawl / Jina call: one row per
-- (day, service, model), incremented atomically. Counts, token totals and an estimated
-- USD cost only: no URLs, prompts, keys or user data.
--
-- Writes: service_role only (record_api_usage). Reads: admin_api_usage_as(actor, days),
-- gated by analytics.read, plus the auth.uid() wrapper for the panel.
--
-- Applied by hand to production (local development points at the production database).
-- Additive; rollback at the bottom. Idempotent: safe to re-run.

create table if not exists public.api_usage_daily (
  day date not null,
  service text not null check (service in ('openai', 'firecrawl', 'jina')),
  -- '' for services without a model (Firecrawl, Jina), so it can sit in the primary key.
  model text not null default '' check (char_length(model) <= 100),
  calls integer not null default 0 check (calls >= 0),
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  failures integer not null default 0 check (failures >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  primary key (day, service, model)
);

alter table public.api_usage_daily enable row level security;

-- No policy: the API roles see nothing; the extraction writes with the service key.
revoke all on public.api_usage_daily from anon, authenticated;
grant select, insert, update, delete on public.api_usage_daily to service_role;

create or replace function public.record_api_usage(
  p_service text,
  p_model text default '',
  p_calls integer default 1,
  p_tokens_in bigint default 0,
  p_tokens_out bigint default 0,
  p_failures integer default 0,
  p_cost_usd numeric default 0
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.api_usage_daily as u (day, service, model, calls, tokens_in, tokens_out, failures, cost_usd)
  values ((now() at time zone 'Europe/Warsaw')::date, p_service, coalesce(p_model, ''),
          greatest(p_calls, 0), greatest(p_tokens_in, 0), greatest(p_tokens_out, 0),
          greatest(p_failures, 0), greatest(p_cost_usd, 0))
  on conflict (day, service, model) do update set
    calls = u.calls + excluded.calls,
    tokens_in = u.tokens_in + excluded.tokens_in,
    tokens_out = u.tokens_out + excluded.tokens_out,
    failures = u.failures + excluded.failures,
    cost_usd = u.cost_usd + excluded.cost_usd
$$;

create or replace function public.admin_api_usage_as(p_actor uuid, p_days integer default 28)
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

  return jsonb_build_object(
    'days', n,
    'since', since,
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'service', service, 'model', model, 'calls', calls, 'tokens_in', tokens_in,
               'tokens_out', tokens_out, 'failures', failures, 'cost_usd', cost_usd)
             order by service, model)
      from (
        select service, model, sum(calls)::bigint as calls, sum(tokens_in)::bigint as tokens_in,
               sum(tokens_out)::bigint as tokens_out, sum(failures)::bigint as failures, sum(cost_usd) as cost_usd
        from public.api_usage_daily
        where day >= since
        group by service, model
      ) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', day, 'service', service, 'calls', calls, 'tokens_in', tokens_in,
               'tokens_out', tokens_out, 'failures', failures, 'cost_usd', cost_usd)
             order by day, service)
      from (
        select day, service, sum(calls)::bigint as calls, sum(tokens_in)::bigint as tokens_in,
               sum(tokens_out)::bigint as tokens_out, sum(failures)::bigint as failures, sum(cost_usd) as cost_usd
        from public.api_usage_daily
        where day >= since
        group by day, service
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_api_usage(p_days integer default 28)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_api_usage_as(auth.uid(), p_days)
$$;

revoke all on function public.record_api_usage(text, text, integer, bigint, bigint, integer, numeric) from public, anon, authenticated;
revoke all on function public.admin_api_usage_as(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_api_usage(integer) from public, anon, authenticated;
grant execute on function public.record_api_usage(text, text, integer, bigint, bigint, integer, numeric) to service_role;
grant execute on function public.admin_api_usage_as(uuid, integer) to service_role;
grant execute on function public.admin_api_usage(integer) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_api_usage_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if has_table_privilege('anon', 'public.api_usage_daily', 'select')
     or has_table_privilege('authenticated', 'public.api_usage_daily', 'select') then
    raise exception 'api usage grant check: an API role can read api_usage_daily';
  end if;
  if has_function_privilege('anon', 'public.record_api_usage(text,text,integer,bigint,bigint,integer,numeric)', 'execute')
     or has_function_privilege('authenticated', 'public.record_api_usage(text,text,integer,bigint,bigint,integer,numeric)', 'execute') then
    raise exception 'api usage grant check: record_api_usage is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_api_usage_as(uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_api_usage_as(uuid,integer)', 'execute') then
    raise exception 'api usage grant check: admin_api_usage_as is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_api_usage(integer)', 'execute') then
    raise exception 'api usage grant check: anon can execute admin_api_usage';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_api_usage(integer)', 'execute') then
    raise exception 'api usage grant check: authenticated cannot execute admin_api_usage';
  end if;
end;
$$;

revoke all on function public.assert_api_usage_grants() from public, anon, authenticated;

select public.assert_api_usage_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_api_usage_grants(), public.admin_api_usage(integer), public.admin_api_usage_as(uuid, integer),
--   public.record_api_usage(text, text, integer, bigint, bigint, integer, numeric);
-- drop table public.api_usage_daily;
