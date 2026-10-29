-- E02-S08 (#376) — guests learn nothing about an author's gender.
--
-- The privacy policy says „Nigdy nie pokazujemy innym: … ani płci”, but E01-S23
-- (20261017210000_author_gender_form.sql) let guests read a grammatical form
-- (f/m). With only two genders, the form IS the gender. Owner decision
-- (2026-10-28): public wording is always neutral („Dodane przez {nazwa}”).
--
-- 1. public_recipes.author_gender_form stays (same name, type and position, so
--    select('*') consumers and create-or-replace keep working) but is always
--    null, and the view no longer joins profiles_private at all.
-- 2. profile_gender_form() is no longer callable by anon or authenticated.
--
-- profiles_private itself is unchanged: owner-only RLS, no anon grant.
-- Idempotent: re-running re-creates the same view and repeats the revoke.
--
-- Owner action: apply to production via the Management API (repo convention).
-- The app stopped reading both before this migration, so order does not matter.
--
-- Rollback: re-run the view block of 20261021090000_recipe_step_images.sql
-- (without its "already has step_images" early return) and
--   grant execute on function public.profile_gender_form(text) to anon, authenticated;

do $view$
declare
  cols text[];
  n int;
begin
  -- Column-order-drift guard: this definition matches the view as of
  -- 20261021090000 (step_images last). A later column would be dropped here.
  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  if n is null or cols[n] <> 'step_images' then
    raise exception 'public_recipes last column is [%], expected step_images — refusing to re-create',
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
      r.step_images
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only), '
  'nothing about the author''s gender (author_gender_form is always null, #376), the '
  'dish grouping key, its accusative, the variant note (E01-S21), last_modified for '
  'sitemap <lastmod>, and step_images (per-step photos, public like steps). Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

select public.assert_public_view_boundary();

revoke all on function public.profile_gender_form(text) from public, anon, authenticated;

comment on function public.profile_gender_form(text) is
  'Grammatical form (f/m/null) of a user''s gender. Not callable by anon or authenticated '
  '(#376): public pages use neutral wording.';
