-- Issue #444 — rolled-back production rehearsal of
-- supabase/migrations/20261021110000_category_tag_facets.sql (= M).
--
-- Build the script as: `begin;` + M + this file, then run it via the Management
-- API query endpoint (see .ai/runs/2026-10-21-recipe-category-indexes/APPLY.md).
-- The final DO block always RAISES REHEARSAL_RESULT, so M rolls back — production
-- is left exactly as it was. It only reads, so it needs no seeding; it just needs
-- at least one category with a tagged recipe.
--
-- Expected (healthy):
--   REHEARSAL_RESULT rows[ok] filter[ok] anon[ok] auth[ok] public[ok]

do $rehearsal$
declare
  cat public.recipe_category;
  tg text;
  cu bigint;       -- unfiltered count of the top tag
  cf bigint;       -- count of the top tag when it is the selected filter
  rows_unf int;
  rows_fil int;
  min_unf bigint;
  sig text := 'public.category_tag_facets(public.recipe_category, text[])';
  t_rows text; t_filter text; t_anon text; t_auth text; t_public text;
begin
  -- The category with the most recipes carrying at least one tag.
  select v.category into cat
  from public.public_recipes v
  where array_length(v.tags, 1) >= 1
  group by v.category
  order by count(*) desc
  limit 1;
  if cat is null then
    raise exception 'REHEARSAL_SETUP needs a category with tagged recipes';
  end if;

  -- The most common tag in that category, and its unfiltered count.
  select f.tag, f.count into tg, cu
  from public.category_tag_facets(cat) f
  order by f.count desc
  limit 1;
  if tg is null then
    raise exception 'REHEARSAL_SETUP no facets for category %', cat;
  end if;

  select count(*), min(f.count) into rows_unf, min_unf from public.category_tag_facets(cat) f;
  t_rows := case when rows_unf > 0 and min_unf > 0 then 'ok'
    else 'FAIL:rows=' || rows_unf || ' min=' || coalesce(min_unf, -1) end;

  -- Filtering by the top tag cannot change that tag's own count (every recipe
  -- carrying it still matches), and cannot widen the result.
  select f.count into cf from public.category_tag_facets(cat, array[tg]) f where f.tag = tg;
  select count(*) into rows_fil from public.category_tag_facets(cat, array[tg]) f;
  t_filter := case when cf = cu and rows_fil <= rows_unf then 'ok'
    else 'FAIL:cf=' || coalesce(cf, -1) || ' cu=' || cu || ' rf=' || rows_fil || ' ru=' || rows_unf end;

  -- Grants: anon + authenticated execute, PUBLIC revoked.
  t_anon := case when has_function_privilege('anon', sig, 'execute') then 'ok' else 'FAIL:no-exec' end;
  t_auth := case when has_function_privilege('authenticated', sig, 'execute') then 'ok' else 'FAIL:no-exec' end;
  t_public := case when has_function_privilege('public', sig, 'execute') then 'FAIL:public-granted' else 'ok' end;

  raise exception 'REHEARSAL_RESULT rows[%] filter[%] anon[%] auth[%] public[%]',
    t_rows, t_filter, t_anon, t_auth, t_public;
end
$rehearsal$;
