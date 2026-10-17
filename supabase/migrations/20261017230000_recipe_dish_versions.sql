-- E01-S21 (#296) — "Versions of the same dish". Spec: .ai/specs/2026-10-17-e01-s21-dish-versions.md
-- (design PR #297). The dish columns themselves already live on recipes from
-- #298 (20261017220000_recipe_dish_columns.sql); this migration adds the read
-- surface S21's UI needs:
--   1. public_recipes gains dish / dish_accusative / variant_note (appended last).
--   2. a partial index on recipes.dish.
--   3. dish_versions(p_recipe_id)  — the other recipes for one recipe's dish,
--      with a favorites COUNT (favorites is owner-only under RLS, so a
--      SECURITY DEFINER count is the only guest-safe way to sort by popularity).
--   4. dish_vocabulary()           — one row per distinct dish, for the runtime
--      classifier to reuse existing dish names (service_role only).
--
-- Additive and idempotent. The dish columns are re-declared with
-- `add column if not exists` and guarded checks so this migration is
-- self-contained and harmless whether or not #298 ran first. No consumer reads
-- the new columns/RPCs until the S21 app build deploys, and that build reads
-- them as optional, so the apply order (migration first, app after) is safe.
--
-- Rollback (schema), in one begin … commit so guests never see a missing view:
--   drop function if exists public.dish_versions(bigint), public.dish_vocabulary();
--   drop view public.public_recipes;  -- then re-create from
--     20261017210000_author_gender_form.sql (with servings) + its grants;
--   drop index if exists public.recipes_dish_idx;
-- (The dish columns are #298's to drop.)
-- Rehearsal: .ai/qa/s21-rehearse-dish-versions.sql (rolled back).

-- 1. Dish columns (idempotent; owned by #298, repeated here for self-containment).
alter table public.recipes
  add column if not exists dish text,
  add column if not exists dish_accusative text,
  add column if not exists variant_note text,
  add column if not exists dish_classified_at timestamptz;

do $checks$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'recipes_dish_format' and conrelid = 'public.recipes'::regclass) then
    alter table public.recipes add constraint recipes_dish_format check (
      dish is null
      or (dish = btrim(dish) and char_length(dish) between 3 and 60 and dish !~ '[A-ZĄĆĘŁŃÓŚŹŻ]')
    );
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'recipes_dish_accusative_format' and conrelid = 'public.recipes'::regclass) then
    alter table public.recipes add constraint recipes_dish_accusative_format check (
      dish_accusative is null or (dish is not null and char_length(dish_accusative) between 3 and 80)
    );
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'recipes_variant_note_length' and conrelid = 'public.recipes'::regclass) then
    alter table public.recipes add constraint recipes_variant_note_length check (
      variant_note is null or char_length(variant_note) between 3 and 60
    );
  end if;
end
$checks$;

-- 2. Partial index serving dish_versions and the SimilarRecipes dish filter.
create index if not exists recipes_dish_idx on public.recipes (dish) where dish is not null;

-- 3. Append dish / dish_accusative / variant_note to the guest-safe view, after
--    author_gender_form. create-or-replace can only append, so the current last
--    two columns MUST be servings, author_gender_form; assert it and fail loudly
--    on a silent reorder, instead of appending in the wrong place.
do $view$
declare
  cols text[];
  n int;
begin
  -- Idempotent: once the view carries dish, there is nothing to append.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'public_recipes' and column_name = 'dish') then
    return;
  end if;

  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  if n is null or cols[n - 1] <> 'servings' or cols[n] <> 'author_gender_form' then
    raise exception 'public_recipes last two columns are [%], expected [servings, author_gender_form] — refusing to append dish',
      array_to_string(cols, ', ');
  end if;

  execute $sql$
    create or replace view public.public_recipes
    with (security_invoker = false)
    as
    select
      r.id,
      r.slug,
      r.title,
      r.description,
      r.image_url,
      r.category,
      r.tags,
      r.prep_time_minutes,
      r.cook_time_minutes,
      r.total_time_minutes,
      r.ingredients,
      r.steps,
      r.source_type,
      r.source_url,
      r.source_author,
      r.times_estimated,
      r.youtube_id,
      r.created_at,
      p.display_name as author_name,
      r.meta_description,
      p.username as author_username,
      coalesce(cardinality(r.image_urls), 0) as gallery_count,
      r.servings,
      case pp.gender when 'female' then 'f' when 'male' then 'm' end as author_gender_form,
      r.dish,
      r.dish_accusative,
      r.variant_note
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    left join public.profiles_private pp on pp.id = r.user_id
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only), '
  'author gender only as a grammatical form (f/m/null), plus the dish grouping key, '
  'its accusative and the variant note (E01-S21). Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

-- 4. dish_versions: the OTHER recipes sharing this recipe's (non-null) dish, with
--    a favorites COUNT (aggregate only — no user_id, no favorite rows leave the
--    function). total_count is count(*) OVER () over every sibling, so the
--    heading can show the full N even though at most 24 rows are returned. The
--    reader's chosen order is applied in TypeScript (sortVersions), so the RPC
--    has one cacheable shape: favorites first.
create or replace function public.dish_versions(p_recipe_id bigint)
returns table (
  id bigint,
  slug text,
  title text,
  image_url text,
  source_type public.recipe_source,
  source_url text,
  source_author text,
  variant_note text,
  servings smallint,
  prep_time_minutes integer,
  cook_time_minutes integer,
  total_time_minutes integer,
  times_estimated boolean,
  ingredients jsonb,
  created_at timestamptz,
  favorites_count integer,
  total_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select r.dish from public.recipes r where r.id = p_recipe_id and r.dish is not null
  ),
  siblings as (
    select
      r.id, r.slug, r.title, r.image_url, r.source_type, r.source_url, r.source_author,
      r.variant_note, r.servings, r.prep_time_minutes, r.cook_time_minutes, r.total_time_minutes,
      r.times_estimated, r.ingredients, r.created_at,
      (select count(*) from public.favorites f where f.recipe_id = r.id)::integer as favorites_count
    from public.recipes r
    join target t on r.dish = t.dish
    where r.id <> p_recipe_id
  )
  select
    s.id, s.slug, s.title, s.image_url, s.source_type, s.source_url, s.source_author,
    s.variant_note, s.servings, s.prep_time_minutes, s.cook_time_minutes, s.total_time_minutes,
    s.times_estimated, s.ingredients, s.created_at, s.favorites_count,
    (count(*) over ())::integer as total_count
  from siblings s
  order by s.favorites_count desc, s.created_at desc, s.id desc
  limit 24
$$;

comment on function public.dish_versions(bigint) is
  'Other recipes for the same dish (E01-S21), with a favorites COUNT only (favorites is '
  'owner-only RLS). total_count = count over all siblings; at most 24 rows returned.';

revoke all on function public.dish_versions(bigint) from public;
grant execute on function public.dish_versions(bigint) to anon, authenticated;

-- 5. dish_vocabulary: one row per distinct dish, most frequent first, for the
--    runtime classifier to reuse existing dish names. group by (not distinct) so
--    PostgREST's db-max-rows cap counts dishes, not recipes; the caller reads the
--    whole set and asserts it is under the cap. service_role only (extraction and
--    backfill use the service client).
create or replace function public.dish_vocabulary()
returns table (
  dish text,
  dish_accusative text,
  recipes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.dish, min(r.dish_accusative) as dish_accusative, count(*)::integer as recipes
  from public.recipes r
  where r.dish is not null
  group by r.dish
  order by count(*) desc
$$;

comment on function public.dish_vocabulary() is
  'Distinct dish names with a representative accusative and recipe count (E01-S21), for the '
  'runtime classifier to reuse existing names. One row per dish; service_role only.';

revoke all on function public.dish_vocabulary() from public;
grant execute on function public.dish_vocabulary() to service_role;
