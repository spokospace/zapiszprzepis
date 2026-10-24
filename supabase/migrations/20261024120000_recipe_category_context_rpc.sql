-- Performance (#464 item 2) — collapse the recipe page's list-bar fallback from
-- four round trips to one.
--
-- loadCategoryContext (src/app/przepis/[slug]/category-context.ts) runs on the
-- recipe critical path and issues FOUR separate queries against public_recipes:
-- a category count, a "newer than this one" count, the nearest-newer row and the
-- nearest-older row. recipe_category_context(p_id) returns the same thing in one
-- call: the recipe's place in its category (newest first — created_at desc, id
-- desc) and its prev/next neighbours.
--
--   total  recipes in the same category (the "N" in "index z total").
--   idx    1-based position, newest first = (count of strictly newer rows) + 1.
--   prev   nearest NEWER recipe as {slug, title}, or null at the newest end.
--   next   nearest OLDER recipe as {slug, title}, or null at the oldest end.
--
-- "Strictly newer" is created_at > p.created_at OR (created_at = p.created_at AND
-- id > p.id) — the exact tiebreak the app used, so the result is identical.
--
-- Reads only the guest-safe public_recipes view, SECURITY INVOKER + search_path =
-- '', so the caller's privileges and RLS apply exactly as for the four queries it
-- replaces. STABLE, no writes. Every scan is served by recipes_category_created_idx
-- (category, created_at desc, id desc) from 20261021100000.
--
-- Additive and idempotent (create or replace); no view, table, column or data
-- change. Apply BEFORE deploying the app that calls it: until then the RPC does
-- not exist and loadCategoryContext logs the error and returns null, so the recipe
-- page simply renders without the list bar (its existing non-critical fallback) —
-- no page breaks. Applying early is safe: nothing else references this function.
--
-- Rollback:
--   drop function if exists public.recipe_category_context(bigint);

create or replace function public.recipe_category_context(p_id bigint)
returns table (
  category public.recipe_category,
  total integer,
  idx integer,
  prev jsonb,
  next jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_category public.recipe_category;
  v_created timestamptz;
begin
  -- The anchor recipe, read through the same guest-safe view. A recipe that is
  -- not public (or does not exist) yields no row, so the caller gets null and
  -- renders no bar — matching the old four-query path.
  select v.category, v.created_at
    into v_category, v_created
    from public.public_recipes v
    where v.id = p_id;

  if not found then
    return;
  end if;

  -- Single row, always: the counts are scalar, and prev/next are scalar jsonb
  -- subqueries that are null at a list end.
  return query
    select
      v_category,
      (select count(*)
         from public.public_recipes v
         where v.category = v_category)::int,
      (select count(*)
         from public.public_recipes v
         where v.category = v_category
           and (v.created_at > v_created or (v.created_at = v_created and v.id > p_id)))::int + 1,
      (select to_jsonb(n)
         from (
           select v.slug, v.title
             from public.public_recipes v
             where v.category = v_category
               and (v.created_at > v_created or (v.created_at = v_created and v.id > p_id))
             order by v.created_at asc, v.id asc
             limit 1
         ) n),
      (select to_jsonb(o)
         from (
           select v.slug, v.title
             from public.public_recipes v
             where v.category = v_category
               and (v.created_at < v_created or (v.created_at = v_created and v.id < p_id))
             order by v.created_at desc, v.id desc
             limit 1
         ) o);
end;
$$;

comment on function public.recipe_category_context(bigint) is
  'The recipe list bar fallback in one call (#464): category total, 1-based index (newest first) and prev/next neighbour {slug,title}. Reads public_recipes.';

revoke all on function public.recipe_category_context(bigint) from public;
grant execute on function public.recipe_category_context(bigint) to anon, authenticated;
