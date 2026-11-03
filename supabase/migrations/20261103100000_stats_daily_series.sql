-- Daily series for the admin charts on /admin/statystyki and /admin/wyszukiwania.
--
-- Re-creates admin_usage_summary_as and admin_search_summary_as with one extra key,
-- `daily`, and leaves every other key as it was:
--   usage:  daily: [{day, event, count}]      one row per (day, event) that has counts
--   search: daily: [{day, clicks, impressions}] site totals per synced day, from the
--           'page' rows (the 'query' rows leave out Google's anonymised queries, so
--           they under-count)
-- Days with nothing counted are absent; the app fills them with zeros.
--
-- Same signatures, so the grants and the auth.uid() wrappers stay as they are; the
-- grant assertions from the earlier migrations are re-run at the bottom.
--
-- Applied only with the owner's explicit go (local development points at the
-- production database). Read-only functions; rollback = re-run the earlier migrations.
--
-- Idempotent: safe to re-run.

create or replace function public.admin_usage_summary_as(p_actor uuid, p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(1, least(coalesce(p_days, 7), 366));
  since date;
begin
  if not public.staff_can(p_actor, 'analytics.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  since := (now() at time zone 'Europe/Warsaw')::date - (n - 1);

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
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'event', d.event, 'count', d.total) order by d.day, d.event)
      from (
        select day, event, sum(count)::bigint as total
        from public.usage_counters
        where day >= since
        group by day, event
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

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
      ), '[]'::jsonb),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', d.day, 'clicks', d.clicks, 'impressions', d.impressions) order by d.day)
        from (
          select day, sum(clicks)::bigint as clicks, sum(impressions)::bigint as impressions
          from public.search_console_daily
          where dimension = 'page' and day >= since
          group by day
        ) d
      ), '[]'::jsonb)
    )
  );
end;
$$;

select public.assert_admin_usage_grants();
select public.assert_search_console_grants();
