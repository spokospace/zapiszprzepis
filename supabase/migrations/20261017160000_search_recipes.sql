-- E01-S05 — one search: a database-side recipe search for /szukaj.
--
--   recipe_search_text(title, ingredients)  lower-cased title + ingredient names,
--       the text every search matches against. Immutable, so it can back an index.
--       Reindex recipes_search_text_trgm_idx if the ingredient JSON shape changes.
--   recipes_search_text_trgm_idx  pg_trgm GIN index over that expression, so the
--       substring match (LIKE '%word%') can use an index scan.
--   search_recipes(query, scope, limit)  the one search: every word must match,
--       title hits first, then newest; total_count for "N przepisów dla „q”".
--
-- Scope: 'all' reads the guest-safe public_recipes view; 'mine' and 'fav' narrow
-- it through the caller's own RLS-visible rows (recipes / favorites are owner-only)
-- and return nothing without a session. The function is SECURITY INVOKER, so the
-- caller's privileges and RLS apply. Each scope is its own statement: anon has no
-- grant on favorites, and Postgres checks table privileges per executed statement,
-- so a guest's 'all' search never touches it.
--
-- Additive and idempotent (create or replace / if not exists); no view, table or
-- data change. pg_trgm is already enabled (20260529093516_init_auth_helpers).
-- Apply BEFORE deploying the app that calls it: until then /szukaj shows
-- "Wyszukiwanie chwilowo nie działa". Applying early is safe — nothing else
-- references these objects.
--
-- Rollback:
--   drop function if exists public.search_recipes(text, text, integer);
--   drop index if exists public.recipes_search_text_trgm_idx;
--   drop function if exists public.recipe_search_text(text, jsonb);
-- Rehearsal: .ai/qa/s05-rehearse-search-recipes.sql (rolled back).
-- Ordering: independent of 20261017140000 (full access gate) and 20261017150000
-- (public_recipes columns): it reads only columns the view already had before both.

create or replace function public.recipe_search_text(p_title text, p_ingredients jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    coalesce(p_title, '') || ' ' ||
    coalesce((
      select string_agg(e ->> 'name', ' ')
      from jsonb_array_elements(
        case when jsonb_typeof(p_ingredients) = 'array' then p_ingredients else '[]'::jsonb end
      ) as e
      where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'name') = 'string'
    ), '')
  )
$$;

comment on function public.recipe_search_text(text, jsonb) is
  'Lower-cased title + ingredient names: the text /szukaj matches (E01-S05). Backs recipes_search_text_trgm_idx.';

create index if not exists recipes_search_text_trgm_idx
  on public.recipes
  using gin (public.recipe_search_text(title, ingredients) public.gin_trgm_ops);

create or replace function public.search_recipes(
  p_query text,
  p_scope text default 'all',
  p_limit integer default 14
)
returns table (
  id bigint,
  slug text,
  title text,
  image_url text,
  category public.recipe_category,
  description text,
  source_type public.recipe_source,
  source_url text,
  source_author text,
  total_time_minutes integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  created_at timestamp with time zone,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_patterns text[];
  v_limit integer := least(greatest(coalesce(p_limit, 14), 1), 140);
  v_user uuid := public.current_user_id();
begin
  if p_scope is null or p_scope not in ('all', 'mine', 'fav') then
    raise exception 'search_recipes: unknown scope %', p_scope using errcode = '22023';
  end if;

  -- Up to 5 words of up to 50 chars; LIKE wildcards and the escape char are literal.
  select array_agg(
           '%' || replace(replace(replace(left(w, 50), '\', '\\'), '%', '\%'), '_', '\_') || '%'
           order by ord
         )
    into v_patterns
    from (
      select w, ord
      from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') with ordinality as t(w, ord)
      where w <> ''
      order by ord
      limit 5
    ) words;

  if v_patterns is null then
    return;
  end if;

  if p_scope <> 'all' and v_user is null then
    return;
  end if;

  if p_scope = 'all' then
    return query
      select v.id, v.slug, v.title, v.image_url, v.category, v.description, v.source_type,
             v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
             v.cook_time_minutes, v.created_at, count(*) over ()
      from public.public_recipes v
      where public.recipe_search_text(v.title, v.ingredients) like v_patterns[1]
        and public.recipe_search_text(v.title, v.ingredients) like all (v_patterns)
      order by lower(v.title) like all (v_patterns) desc, v.created_at desc, v.id desc
      limit v_limit;
  elsif p_scope = 'mine' then
    return query
      select v.id, v.slug, v.title, v.image_url, v.category, v.description, v.source_type,
             v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
             v.cook_time_minutes, v.created_at, count(*) over ()
      from public.public_recipes v
      where public.recipe_search_text(v.title, v.ingredients) like v_patterns[1]
        and public.recipe_search_text(v.title, v.ingredients) like all (v_patterns)
        and exists (select 1 from public.recipes r where r.id = v.id and r.user_id = v_user)
      order by lower(v.title) like all (v_patterns) desc, v.created_at desc, v.id desc
      limit v_limit;
  else
    return query
      select v.id, v.slug, v.title, v.image_url, v.category, v.description, v.source_type,
             v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
             v.cook_time_minutes, v.created_at, count(*) over ()
      from public.public_recipes v
      where public.recipe_search_text(v.title, v.ingredients) like v_patterns[1]
        and public.recipe_search_text(v.title, v.ingredients) like all (v_patterns)
        and exists (select 1 from public.favorites f where f.recipe_id = v.id and f.user_id = v_user)
      order by lower(v.title) like all (v_patterns) desc, v.created_at desc, v.id desc
      limit v_limit;
  end if;
end;
$$;

comment on function public.search_recipes(text, text, integer) is
  'The one recipe search (E01-S05): scope all | mine | fav, every word must match title or an ingredient name.';

revoke all on function public.search_recipes(text, text, integer) from public;
grant execute on function public.search_recipes(text, text, integer) to anon, authenticated;
