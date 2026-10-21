-- Per-step recipe photos (ZMIANA_zdjecia_krokow). A recipe may carry one archived
-- image per step; this adds the index-aligned store and exposes it on the guest-safe
-- view, because step photos are public exactly like the steps themselves.
--
-- Additive + idempotent. Existing recipes get '{}' (no step photos), so the page
-- renders exactly as today until an import populates the column.
--
-- Owner action: apply to production via the Management API (repo convention). The
-- boundary guard is re-run at the end (step_images is neither user_id nor
-- image_urls, so the allowlist still holds).

alter table public.recipes
  add column if not exists step_images text[] not null default '{}';

comment on column public.recipes.step_images is
  'Per-step archived image URLs, index-aligned with steps (element i = step i''s '
  'photo, '''' = that step has none). Public like steps; exposed on public_recipes.';

-- Append step_images to the guest-safe view. `create or replace view` can only
-- APPEND columns, so assert the current tail is last_modified before re-creating
-- (column-order-drift guard, same idiom as 20261020120000).
do $view$
declare
  cols text[];
  n int;
begin
  -- Idempotent: once the view carries step_images there is nothing to append.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'public_recipes' and column_name = 'step_images') then
    return;
  end if;

  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  if n is null or cols[n] <> 'last_modified' then
    raise exception 'public_recipes last column is [%], expected last_modified — refusing to append step_images',
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
      coalesce(r.updated_at, r.created_at) as last_modified,
      r.step_images
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    left join public.profiles_private pp on pp.id = r.user_id
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only), '
  'author gender only as a grammatical form (f/m/null), the dish grouping key, its '
  'accusative, the variant note (E01-S21), last_modified for sitemap <lastmod>, and '
  'step_images (per-step photos, public like steps). Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

-- step_images is neither user_id nor image_urls, so the allowlist boundary still
-- holds; assert it (issue #403) after re-creating the view.
select public.assert_public_view_boundary();
