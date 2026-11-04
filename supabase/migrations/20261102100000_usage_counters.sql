-- First-party cookieless usage analytics, Phase 1 — the daily counter table and its writer.
-- Spec: .ai/specs/2026-10-30-first-party-usage-analytics.md (Data Model)
--
-- Only aggregate counts are stored: (Warsaw calendar day, event, recipe slug or category
-- key) -> how many times. No IP, user-agent, user id or timestamp finer than a day.
--
-- Who can do what: nobody but service_role. The table has RLS on, no policy and no
-- grant; usage_count() is executable by service_role only (the /api/e route calls it).
-- The day is computed here, so a client can never choose or skew it.
--
-- Applied only with the owner's explicit go (local development points at the
-- production database). Additive; rollback is dropping the function and the table.
--
-- Idempotent: safe to re-run.

create table if not exists public.usage_counters (
  day date not null,
  event text not null check (event in ('recipe_view', 'category_view', 'timer_start', 'print', 'favorite_add')),
  subject text not null check (char_length(subject) between 1 and 120),
  count bigint not null default 0,
  primary key (day, event, subject)
);

alter table public.usage_counters enable row level security;

-- No policy and no grant: reachable only through usage_count() below.
revoke all on public.usage_counters from anon, authenticated;

create or replace function public.usage_count(p_event text, p_subject text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event is null or p_event not in ('recipe_view', 'category_view', 'timer_start', 'print', 'favorite_add') then
    raise exception 'unknown usage event' using errcode = '22023';
  end if;
  if p_subject is null or char_length(p_subject) not between 1 and 120 then
    raise exception 'invalid usage subject' using errcode = '22023';
  end if;

  insert into public.usage_counters (day, event, subject, count)
  values ((now() at time zone 'Europe/Warsaw')::date, p_event, p_subject, 1)
  on conflict (day, event, subject) do update set count = public.usage_counters.count + 1;
end;
$$;

revoke all on function public.usage_count(text, text) from public, anon, authenticated;
grant execute on function public.usage_count(text, text) to service_role;
