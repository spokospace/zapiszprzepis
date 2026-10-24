-- Issue #464 item 2 — rolled-back production rehearsal of
-- supabase/migrations/20261024120000_recipe_category_context_rpc.sql (= M).
--
-- Build the script as: `begin;` + M + this file, then run it via the Management
-- API query endpoint (see .ai/runs/2026-10-21-category-tag-facets/APPLY.md).
-- The final DO block always RAISES REHEARSAL_RESULT, so M rolls back — production
-- is left exactly as it was. It only reads; it needs a category with >= 3 public
-- recipes.
--
-- It cross-checks recipe_category_context against an INDEPENDENT window-function
-- computation (row_number / lag / lead over created_at desc, id desc) for a recipe
-- in the middle of the biggest category, and checks the two list ends, a missing
-- id, and the grants.
--
-- Expected (healthy):
--   REHEARSAL_RESULT mid[ok] first[ok] last[ok] missing[ok] grants[ok]

do $rehearsal$
declare
  cat public.recipe_category;
  n int;
  mid_id bigint; first_id bigint; last_id bigint;
  r record;
  e_rn int; e_total bigint;
  e_prev_slug text; e_prev_title text; e_next_slug text; e_next_title text;
  sig text := 'public.recipe_category_context(bigint)';
  t_mid text; t_first text; t_last text; t_missing text; t_grants text;
begin
  -- The category with the most public recipes.
  select v.category, count(*) into cat, n
  from public.public_recipes v
  group by v.category
  order by count(*) desc
  limit 1;
  if cat is null or n < 3 then
    raise exception 'REHEARSAL_SETUP needs a category with >= 3 public recipes (got %)', coalesce(n, 0);
  end if;

  select v.id into first_id from public.public_recipes v where v.category = cat order by v.created_at desc, v.id desc limit 1;
  select v.id into last_id  from public.public_recipes v where v.category = cat order by v.created_at asc,  v.id asc  limit 1;
  select v.id into mid_id   from public.public_recipes v where v.category = cat order by v.created_at desc, v.id desc offset (n / 2) limit 1;

  -- MID: compare every field against the window-function expectation. In newest-first
  -- order lag() is the newer neighbour (= prev / „Poprzedni”), lead() the older (= next).
  select o.rn, o.total, o.prev_slug, o.prev_title, o.next_slug, o.next_title
    into e_rn, e_total, e_prev_slug, e_prev_title, e_next_slug, e_next_title
  from (
    select v.id,
           row_number() over w as rn,
           count(*) over () as total,
           lag(v.slug)  over w as prev_slug,
           lag(v.title) over w as prev_title,
           lead(v.slug) over w as next_slug,
           lead(v.title) over w as next_title
    from public.public_recipes v
    where v.category = cat
    window w as (order by v.created_at desc, v.id desc)
  ) o
  where o.id = mid_id;

  select * into r from public.recipe_category_context(mid_id);
  t_mid := case
    when r.total = e_total and r.idx = e_rn
     and (r.prev ->> 'slug')  is not distinct from e_prev_slug
     and (r.prev ->> 'title') is not distinct from e_prev_title
     and (r.next ->> 'slug')  is not distinct from e_next_slug
     and (r.next ->> 'title') is not distinct from e_next_title
    then 'ok'
    else 'FAIL idx=' || r.idx || '/' || e_rn || ' total=' || r.total || '/' || e_total
      || ' prev=' || coalesce(r.prev ->> 'slug', 'null') || '/' || coalesce(e_prev_slug, 'null')
      || ' next=' || coalesce(r.next ->> 'slug', 'null') || '/' || coalesce(e_next_slug, 'null')
  end;

  -- FIRST (newest): idx 1, no prev, a next.
  select * into r from public.recipe_category_context(first_id);
  t_first := case when r.idx = 1 and r.total = n and r.prev is null and r.next is not null
    then 'ok' else 'FAIL idx=' || r.idx || ' prev=' || coalesce(r.prev::text, 'null') || ' next=' || coalesce(r.next::text, 'null') end;

  -- LAST (oldest): idx n, a prev, no next.
  select * into r from public.recipe_category_context(last_id);
  t_last := case when r.idx = n and r.total = n and r.prev is not null and r.next is null
    then 'ok' else 'FAIL idx=' || r.idx || '/' || n || ' prev=' || coalesce(r.prev::text, 'null') || ' next=' || coalesce(r.next::text, 'null') end;

  -- A missing / non-public id yields no row (recipe ids are positive, so 0 never exists).
  t_missing := case when exists (select 1 from public.recipe_category_context(0)) then 'FAIL:row-for-missing' else 'ok' end;

  -- Grants: anon + authenticated execute, PUBLIC revoked.
  t_grants := case when has_function_privilege('anon', sig, 'execute')
                    and has_function_privilege('authenticated', sig, 'execute')
                    and not has_function_privilege('public', sig, 'execute')
    then 'ok' else 'FAIL' end;

  raise exception 'REHEARSAL_RESULT mid[%] first[%] last[%] missing[%] grants[%]',
    t_mid, t_first, t_last, t_missing, t_grants;
end
$rehearsal$;
