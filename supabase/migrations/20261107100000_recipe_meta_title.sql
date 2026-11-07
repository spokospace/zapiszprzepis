-- Recipe SEO titles (#745): an optional <title> base per recipe, mirroring
-- category_descriptions.meta_title (20261022170000).
--
-- Recipe pages built their <title> as `{title} · Zapisz Przepis`, so different recipes
-- that share a dish name (five "Barszcz ukraiński" from five sources) had the same
-- title: 43 groups, 103 URLs in the 2026-11-06 sitemap run. The app now adds the
-- recipe's short variant line (`description`, e.g. "z białą fasolą") to the title;
-- meta_title overrides that for the recipes where the result still collides or the
-- owner wants a hand-written title.
--
-- The column holds the title BASE (no brand suffix); the app appends
-- `· Zapisz Przepis` for the browser tab, while Open Graph / Twitter keep the dish
-- name. char_length 1..70 matches the category title budget. Re-extraction never
-- writes this column, so a hand-written title survives a refresh. Every change still
-- bumps content_version (recipes_bump_content_version), so the static recipe files
-- are rebuilt with the new title.
--
-- Order: apply THIS migration BEFORE deploying the app that reads meta_title. The
-- old app keeps working (the view only gains a trailing column).
--
-- Idempotent: safe to re-run.
--
-- Rollback (manual): re-create public_recipes without meta_title by re-running the
-- view block of 20261104100000_recipe_extra_categories.sql after `drop view
-- public.public_recipes`, then:
--   alter table public.recipes
--     drop constraint if exists recipes_meta_title_len,
--     drop column if exists meta_title;

alter table public.recipes
  add column if not exists meta_title text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_meta_title_len') then
    alter table public.recipes
      add constraint recipes_meta_title_len
      check (meta_title is null or char_length(btrim(meta_title)) between 1 and 70);
  end if;
end $$;

comment on column public.recipes.meta_title is
  'Optional SEO <title> base for the recipe page (brand suffix appended by the app). '
  'Null: the app uses the title plus the variant line (description). Never written by extraction.';

-- ── public_recipes: meta_title as the last column ──────────────────────────

do $view$
declare
  cols text[];
  n int;
begin
  -- Column-order-drift guard: restates the view as 20261104100000 leaves it
  -- (extra_categories last). Already extended (re-run): nothing to do.
  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  if n is not null and cols[n] = 'meta_title' then
    return;
  end if;
  if n is null or cols[n] <> 'extra_categories' then
    raise exception 'public_recipes last column is [%], expected extra_categories — refusing to re-create',
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
      null::text as author_gender_form,
      r.dish,
      r.dish_accusative,
      r.variant_note,
      coalesce(r.updated_at, r.created_at) as last_modified,
      r.step_images,
      r.extra_categories,
      r.meta_title
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    where r.hidden_at is null
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every visible recipe (E01). No user_id, no gallery URLs (count only), '
  'nothing about the author''s gender (author_gender_form is always null, #376), the '
  'dish grouping key, its accusative, the variant note (E01-S21), last_modified for '
  'sitemap <lastmod>, step_images (per-step photos, public like steps), '
  'extra_categories (#689) and meta_title (#745). Recipes hidden by staff (hidden_at) '
  'are not in it. Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

select public.assert_public_view_boundary();
