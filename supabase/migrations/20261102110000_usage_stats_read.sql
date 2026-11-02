-- First-party cookieless usage analytics, Phase 4 — the staff read side.
-- Spec: .ai/specs/2026-10-30-first-party-usage-analytics.md (Phase 4, steps 11-12)
--
-- Adds the staff permission `analytics.read` (admin only, like audit.read: it is a
-- site-wide view, not part of the moderator's recipe and import work) and the read
-- RPC admin_usage_summary(p_days) over public.usage_counters.
--
-- Same shape as admin_list_audit: an `_as(actor, ...)` function that checks the
-- permission with staff_can() (service_role only, for the MCP/tests) and a wrapper
-- bound to auth.uid() for the panel. Returns one jsonb document:
--   { days, since, categories:[{subject, views, recipes}], recipes:[{slug, title, views}],
--     orphan_views, features:[{event, count}] }
-- Recipe views for slugs that no longer match a public recipe are not listed; their
-- total is returned as orphan_views. Nothing here writes; no audit row (reads are not audited).
--
-- Applied only with the owner's explicit go (local development points at the
-- production database). Additive; rollback at the bottom.
--
-- Idempotent: safe to re-run.

insert into public.staff_role_permissions (role, permission) values ('admin', 'analytics.read')
on conflict do nothing;

create or replace function public.admin_usage_summary_as(p_actor uuid, p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(1, least(coalesce(p_days, 7), 366));
  since date := (now() at time zone 'Europe/Warsaw')::date - (greatest(1, least(coalesce(p_days, 7), 366)) - 1);
begin
  if not public.staff_can(p_actor, 'analytics.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', n,
    'since', since,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('subject', c.subject, 'views', c.views, 'recipes', coalesce(r.recipes, 0))
                       order by c.views desc, c.subject)
      from (
        select subject, sum(count)::bigint as views
        from public.usage_counters
        where event = 'category_view' and day >= since
        group by subject
      ) c
      left join (
        select category::text as subject, count(*)::bigint as recipes
        from public.public_recipes
        group by category
      ) r on r.subject = c.subject
    ), '[]'::jsonb),
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object('slug', t.slug, 'title', t.title, 'views', t.views)
                       order by t.views desc, t.slug)
      from (
        select p.slug, p.title, sum(u.count)::bigint as views
        from public.usage_counters u
        join public.public_recipes p on p.slug = u.subject
        where u.event = 'recipe_view' and u.day >= since
        group by p.slug, p.title
        order by sum(u.count) desc, p.slug
        limit 20
      ) t
    ), '[]'::jsonb),
    'orphan_views', coalesce((
      select sum(u.count)::bigint
      from public.usage_counters u
      where u.event = 'recipe_view' and u.day >= since
        and not exists (select 1 from public.public_recipes p where p.slug = u.subject)
    ), 0),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('event', f.event, 'count', f.total) order by f.event)
      from (
        select event, sum(count)::bigint as total
        from public.usage_counters
        where event in ('timer_start', 'print', 'favorite_add') and day >= since
        group by event
      ) f
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_usage_summary(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_usage_summary_as(auth.uid(), p_days)
$$;

revoke all on function public.admin_usage_summary_as(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_usage_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_usage_summary_as(uuid, integer) to service_role;
grant execute on function public.admin_usage_summary(integer) to authenticated;

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.admin_usage_summary(integer), public.admin_usage_summary_as(uuid, integer);
-- delete from public.staff_role_permissions where permission = 'analytics.read';
