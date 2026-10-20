-- Sitemap + markdown alternates (Phase 1). Spec:
-- .ai/specs/2026-10-20-sitemap-and-md-alternates.md (design PR #362, issue #363).
--
-- The sitemap needs a per-recipe <lastmod>. recipes.updated_at carries it, but
-- public_recipes deliberately drops updated_at. This migration appends a single
-- derived column, last_modified = coalesce(updated_at, created_at), to the
-- guest-safe view — the most recent of "edited" or "added".
--
-- Additive and idempotent. `create or replace view` can only APPEND, so this
-- asserts the current last column is variant_note (the tail added by
-- 20261017230000_recipe_dish_versions.sql) before re-creating the view, and
-- fails loudly on a silent reorder rather than appending in the wrong place.
-- No consumer requires the column: listCanonicalRecipes reads it as optional and
-- falls back to created_at, so the apply order (migration first, app after) is
-- safe in either direction.
--
-- Rollback (schema), in one begin … commit so guests never see a missing view:
--   drop view public.public_recipes;  -- then re-create from
--     20261017230000_recipe_dish_versions.sql (through variant_note) + its grants.

do $view$
declare
  cols text[];
  n int;
begin
  -- Idempotent: once the view carries last_modified, there is nothing to append.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'public_recipes' and column_name = 'last_modified') then
    return;
  end if;

  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  if n is null or cols[n] <> 'variant_note' then
    raise exception 'public_recipes last column is [%], expected variant_note — refusing to append last_modified',
      coalesce(cols[n], '<none>');
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
      r.variant_note,
      coalesce(r.updated_at, r.created_at) as last_modified
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    left join public.profiles_private pp on pp.id = r.user_id
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only), '
  'author gender only as a grammatical form (f/m/null), the dish grouping key, its '
  'accusative and the variant note (E01-S21), plus last_modified = coalesce(updated_at, '
  'created_at) for sitemap <lastmod>. Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;
