-- Search understands Polish word forms, missing Polish letters and some typos.
--
-- search_recipes matched each word as a literal substring, so „pierogów”, „szarlotki” and
-- „zupy” found nothing while „ser” also found „seler” and „dyni” found „budyń”. It now
-- matches each word with pg_trgm's <% on text without Polish letters, then ranks closest
-- title first. Same signature and same columns, so the app does not change.
--
-- <% reads pg_trgm.word_similarity_threshold, default 0.6. On our recipes 0.5 let in about
-- six times the wrong results and 0.7 left three times as many searches empty.
--
-- Order: independent of any deploy. Applied only with the owner's go, through the
-- Management API, followed by: notify pgrst, 'reload schema';
-- Check: supabase/tests/search_word_similarity.sql
--
-- Rollback: re-run the search_recipes block of 20261104100000_recipe_extra_categories.sql,
-- re-create recipes_search_text_trgm_idx (20261017160000_search_recipes.sql), then drop
-- recipes_search_folded_trgm_idx and the recipe_search_* helpers below, except
-- recipe_search_text.
--
-- Idempotent: safe to re-run.

create or replace function public.recipe_search_fold(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(lower(coalesce(p_text, '')), 'ąćęłńóśźż', 'acelnoszz')
$$;

comment on function public.recipe_search_fold(text) is
  'Lower-cased text without Polish letters, so „kielbasa” finds „kiełbasa”.';

create or replace function public.recipe_search_folded(p_title text, p_ingredients jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.recipe_search_fold(public.recipe_search_text(p_title, p_ingredients))
$$;

comment on function public.recipe_search_folded(text, jsonb) is
  'The text search matches. Backs recipes_search_folded_trgm_idx: reindex if this or recipe_search_text changes.';

create index if not exists recipes_search_folded_trgm_idx
  on public.recipes
  using gin (public.recipe_search_folded(title, ingredients) public.gin_trgm_ops);

drop index if exists public.recipes_search_text_trgm_idx;

create or replace function public.recipe_search_matches(p_words text[], p_text text)
returns boolean
language sql
stable
parallel safe
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(p_words) as w where not (w operator(public.<%) p_text)
  )
$$;

comment on function public.recipe_search_matches(text[], text) is
  'True when every word is close to some word of the text.';

create or replace function public.recipe_search_rank(p_words text[], p_text text)
returns real
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(sum(public.strict_word_similarity(w, p_text)), 0)::real from unnest(p_words) as w
$$;

comment on function public.recipe_search_rank(text[], text) is
  'How closely the words match whole words of the text; an exact word scores 1.';

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
  extra_categories public.recipe_category[],
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
  v_words text[];
  v_folded text[];
  v_only bigint[];
  v_limit integer := least(greatest(coalesce(p_limit, 14), 1), 140);
  v_user uuid := public.current_user_id();
begin
  if p_scope is null or p_scope not in ('all', 'mine', 'fav') then
    raise exception 'search_recipes: unknown scope %', p_scope using errcode = '22023';
  end if;

  -- Up to 5 words of up to 50 chars.
  select array_agg(left(w, 50) order by ord)
    into v_words
    from (
      select w, ord
      from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') with ordinality as t(w, ord)
      where w <> ''
      order by ord
      limit 5
    ) words;

  if v_words is null then
    return;
  end if;

  -- „z”, „w” and „na” say nothing about the dish, unless nothing longer was typed. Every word
  -- must match, and one this short has too few trigrams to compare.
  select coalesce(array_agg(w) filter (where char_length(w) > 2), v_words)
    into v_words
    from unnest(v_words) as w;

  select array_agg(public.recipe_search_fold(w)) into v_folded from unnest(v_words) as w;

  if p_scope <> 'all' and v_user is null then
    return;
  end if;

  -- anon has no grant on favorites, and Postgres checks table privileges per executed
  -- statement, so a guest must never run the 'fav' one.
  if p_scope = 'mine' then
    select coalesce(array_agg(r.id), '{}') into v_only from public.recipes r where r.user_id = v_user;
  elsif p_scope = 'fav' then
    select coalesce(array_agg(f.recipe_id), '{}') into v_only from public.favorites f where f.user_id = v_user;
  end if;

  -- The first word alone uses the index. The title is ranked with its Polish letters, so
  -- „mak” puts poppy seed before „mąka”.
  return query
    select v.id, v.slug, v.title, v.image_url, v.category, v.extra_categories, v.description, v.source_type,
           v.source_url, v.source_author, v.total_time_minutes, v.prep_time_minutes,
           v.cook_time_minutes, v.created_at, count(*) over ()
    from public.public_recipes v
    where v_folded[1] operator(public.<%) public.recipe_search_folded(v.title, v.ingredients)
      and public.recipe_search_matches(v_folded, public.recipe_search_folded(v.title, v.ingredients))
      and (v_only is null or v.id = any (v_only))
    order by public.recipe_search_rank(v_words, lower(v.title)) desc,
             public.recipe_search_rank(v_folded, public.recipe_search_folded(v.title, v.ingredients)) desc,
             v.created_at desc, v.id desc
    limit v_limit;
end;
$$;

comment on function public.search_recipes(text, text, integer) is
  'The one recipe search (E01-S05): scope all | mine | fav, every word must be close to a word of the title or an ingredient name, closest title first. Rows carry extra_categories (#689) for the category filter.';

revoke all on function public.search_recipes(text, text, integer) from public;
grant execute on function public.search_recipes(text, text, integer) to anon, authenticated;
