-- Admin panel, Phase 2 — recipe hiding: columns, the two public views, staff read,
-- list / read / hide / unhide.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (Data Model "Phase 2", API Contracts)
--
-- A hidden recipe is gone for guests and for everybody who is not staff: both public
-- read views (public_recipes, recipe_gallery_images) gain `where hidden_at is null`.
-- Everything that reads recipes through them follows without a change of its own:
-- search_recipes, category_tag_facets, the category-context function, the sitemap,
-- llms.txt, the .md mirrors, the home feed, recipe of the day, similar recipes and
-- /u/{username}. Consequence, accepted: the "mine" and "fav" search scopes omit hidden
-- recipes too. The lists "Moje przepisy" and "Ulubione" read the tables directly and
-- show an "unavailable" row instead.
--
-- dish_versions is the one SECURITY DEFINER reader that guests can call over `recipes` itself,
-- so it is restated below with the same filter.
--
-- Staff read recipes (hidden ones included) through the table, under a SELECT policy
-- that asks has_permission('recipes.read'). Writes stay service-only: authenticated has
-- no UPDATE on recipes (20261020190000), so an owner cannot unhide their own recipe.
--
-- assert_public_view_boundary() learns two things: hidden_* never appear in the
-- public_recipes output columns, and both views' definitions keep the filter. A later
-- `create or replace view` that drops it fails its own migration.
--
-- Requires 20261028100000, 20261028110000 and 20261028160000 (the public_recipes
-- definition restated below is the one 20261028160000 leaves). Applied only with the
-- owner's explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

-- ── Columns ─────────────────────────────────────────────────────────────────

alter table public.recipes
  add column if not exists hidden_at timestamp with time zone,
  add column if not exists hidden_by uuid,
  add column if not exists hidden_reason text;

do $$
begin
  alter table public.recipes
    add constraint recipes_hidden_reason_length check (hidden_reason is null or char_length(hidden_reason) <= 200);
exception when duplicate_object then null;
end $$;

-- Hidden recipes are the exception; the index serves the staff "hidden" filter.
create index if not exists idx_recipes_hidden_at on public.recipes (hidden_at) where hidden_at is not null;

comment on column public.recipes.hidden_at is
  'Admin panel: set when staff hide the recipe from everybody but staff. Never exposed by public_recipes.';

-- ── Staff read ──────────────────────────────────────────────────────────────

-- Additive: the owner policy stays as it is. (select ...) lets Postgres evaluate the
-- permission once per statement instead of once per row.
drop policy if exists recipes_staff_select on public.recipes;
create policy recipes_staff_select
  on public.recipes
  for select
  to authenticated
  using ((select public.has_permission('recipes.read')));

-- ── The public views ────────────────────────────────────────────────────────

do $view$
declare
  cols text[];
  n int;
begin
  -- Column-order-drift guard: this restates the view as 20261028160000 leaves it
  -- (step_images last). A later column would be dropped here.
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
    where r.hidden_at is null
  $sql$;
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every visible recipe (E01). No user_id, no gallery URLs (count only), '
  'nothing about the author''s gender (author_gender_form is always null, #376), the '
  'dish grouping key, its accusative, the variant note (E01-S21), last_modified for '
  'sitemap <lastmod>, and step_images (per-step photos, public like steps). Recipes '
  'hidden by staff (hidden_at) are not in it. Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

create or replace view public.recipe_gallery_images
with (security_invoker = false)
as
select r.id, r.image_urls
from public.recipes r
where r.hidden_at is null;

comment on view public.recipe_gallery_images is
  'Recipe galleries for signed-in visitors (E01, Q3), visible recipes only. Read-only; no anon access.';

revoke all on public.recipe_gallery_images from anon, authenticated;
grant select on public.recipe_gallery_images to authenticated;

-- ── Boundary assertion, extended ────────────────────────────────────────────

create or replace function public.assert_public_view_boundary()
returns void
language plpgsql
set search_path = ''
as $fn$
declare
  cols text[];
  view_name text;
begin
  -- public_recipes output columns must exclude owner identity and gallery URLs.
  select array_agg(column_name::text) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';

  if cols is null then
    raise exception 'assert_public_view_boundary: view public.public_recipes is missing';
  end if;
  if 'user_id' = any (cols) then
    raise exception 'assert_public_view_boundary: public_recipes exposes user_id (forbidden); columns: %', cols;
  end if;
  if 'image_urls' = any (cols) then
    raise exception 'assert_public_view_boundary: public_recipes exposes image_urls (forbidden); columns: %', cols;
  end if;
  -- Moderation state is staff-only: not even a flag, or the view would tell guests what is hidden.
  if cols && array['hidden_at', 'hidden_by', 'hidden_reason'] then
    raise exception 'assert_public_view_boundary: public_recipes exposes hidden_* (forbidden); columns: %', cols;
  end if;

  -- Both public views keep the filter that removes hidden recipes.
  foreach view_name in array array['public.public_recipes', 'public.recipe_gallery_images'] loop
    if pg_get_viewdef(view_name::regclass) !~* 'hidden_at\s+is\s+null' then
      raise exception 'assert_public_view_boundary: % no longer filters hidden recipes (hidden_at is null)', view_name;
    end if;
  end loop;

  -- recipe_gallery_images is a signed-in perk (decision Q3): never anon-readable.
  if has_table_privilege('anon', 'public.recipe_gallery_images', 'SELECT') then
    raise exception 'assert_public_view_boundary: recipe_gallery_images is SELECT-able by anon (forbidden)';
  end if;

  -- Positive read contract: the catalog view stays anon-readable, the gallery
  -- stays readable by signed-in users.
  if not has_table_privilege('anon', 'public.public_recipes', 'SELECT') then
    raise exception 'assert_public_view_boundary: public_recipes is not SELECT-able by anon (public read contract broken)';
  end if;
  if not has_table_privilege('authenticated', 'public.recipe_gallery_images', 'SELECT') then
    raise exception 'assert_public_view_boundary: recipe_gallery_images is not SELECT-able by authenticated';
  end if;

  -- Both views are read-only to request-facing roles. recipe_gallery_images is a
  -- single-table auto-updatable view, so an UPDATE grant would let a signed-in
  -- user rewrite image_urls past RLS (the exact risk the 20261016180000 revoke
  -- closes); assert it stays closed.
  if has_table_privilege('authenticated', 'public.recipe_gallery_images', 'UPDATE') then
    raise exception 'assert_public_view_boundary: recipe_gallery_images is UPDATE-able by authenticated (forbidden)';
  end if;
  if has_table_privilege('authenticated', 'public.public_recipes', 'UPDATE') then
    raise exception 'assert_public_view_boundary: public_recipes is UPDATE-able by authenticated (forbidden)';
  end if;
end;
$fn$;

select public.assert_public_view_boundary();

-- ── dish_versions ("other versions of this dish") ───────────────────────────

-- The one SECURITY DEFINER reader of `recipes` that guests can call (granted to anon),
-- so it does not follow the view filter on its own: restated here with `hidden_at is null`
-- on the target and on every sibling. Otherwise a hidden recipe would keep appearing in
-- the "versions" strip of its dish. Body and signature are those of 20261017230000.
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
    select r.dish from public.recipes r where r.id = p_recipe_id and r.dish is not null and r.hidden_at is null
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
      and r.hidden_at is null
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

revoke all on function public.dish_versions(bigint) from public;
grant execute on function public.dish_versions(bigint) to anon, authenticated;

-- ── The viewer's own hidden recipes ─────────────────────────────────────────

-- True when `p_slug` is a hidden recipe the caller owns or has favorited: the app then
-- shows "Przepis jest niedostępny" instead of a 404. The public views cannot answer
-- this (they no longer hold the recipe) and RLS lets a favoriter see neither the
-- recipe nor its slug, so the check lives in SQL. Anon gets false.
create or replace function public.recipe_hidden_for_viewer(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.recipes r
    where r.slug = p_slug
      and r.hidden_at is not null
      and (
        r.user_id = auth.uid()
        or exists (select 1 from public.favorites f where f.recipe_id = r.id and f.user_id = auth.uid())
      )
  )
$$;

-- ── Row type shared by list and get ─────────────────────────────────────────

do $$
begin
  create type public.admin_recipe_row as (
    recipe_id bigint,
    slug text,
    title text,
    category text,
    source_type text,
    source_url text,
    owner_id uuid,
    owner_username text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    hidden_at timestamp with time zone,
    hidden_reason text,
    favorite_count bigint
  );
exception when duplicate_object then null;
end $$;

-- ── Read ────────────────────────────────────────────────────────────────────

-- p_filter: 'all' (default), 'hidden' or 'visible'. p_query matches the title, slug,
-- source link, source author or the owner's username (a literal match: % and _ typed by
-- staff are not wildcards), or a recipe id when it is all digits. Newest first; keyset
-- paging by (created_at, id).
create or replace function public.admin_recipe_rows(
  p_actor uuid,
  p_query text,
  p_filter text,
  p_recipe bigint,
  p_limit integer,
  p_after_created timestamp with time zone,
  p_after_id bigint
)
returns setof public.admin_recipe_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
  q_id bigint;
  f text := coalesce(p_filter, 'all');
begin
  if not public.staff_can(p_actor, 'recipes.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if f not in ('all', 'hidden', 'visible') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if q is not null then
    if q ~ '^[0-9]{1,18}$' then
      q_id := q::bigint;
    end if;
    q := '%' || regexp_replace(q, '([\\%_])', '\\\1', 'g') || '%';
  end if;

  return query
    select
      r.id,
      r.slug,
      r.title,
      r.category::text,
      r.source_type::text,
      r.source_url,
      r.user_id,
      p.username,
      r.created_at,
      r.updated_at,
      r.hidden_at,
      r.hidden_reason,
      (select count(*) from public.favorites fv where fv.recipe_id = r.id)
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    where (p_recipe is null or r.id = p_recipe)
      and (f = 'all' or (f = 'hidden' and r.hidden_at is not null) or (f = 'visible' and r.hidden_at is null))
      and (q is null
           or r.id = q_id
           or r.title ilike q
           or r.slug ilike q
           or r.source_url ilike q
           or r.source_author ilike q
           or p.username ilike q)
      and (p_after_created is null or (r.created_at, r.id) < (p_after_created, p_after_id))
    order by r.created_at desc, r.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.admin_list_recipes_as(
  p_actor uuid,
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 50,
  p_after_created timestamp with time zone default null,
  p_after_id bigint default null
)
returns setof public.admin_recipe_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_recipe_rows(p_actor, p_query, p_filter, null, p_limit, p_after_created, p_after_id)
$$;

create or replace function public.admin_get_recipe_as(p_actor uuid, p_recipe bigint)
returns setof public.admin_recipe_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_recipe_rows(p_actor, null, 'all', p_recipe, 1, null, null)
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

-- Hide / unhide return the slug so the caller can invalidate the right caches after
-- the commit. Idempotent: hiding a hidden recipe keeps the first timestamp; both are audited.
create or replace function public.admin_hide_recipe_as(
  p_actor uuid,
  p_recipe bigint,
  p_reason text default null,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  why text := left(nullif(btrim(coalesce(p_reason, '')), ''), 200);
begin
  if not public.staff_can(p_actor, 'recipes.hide') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.recipes
  set hidden_at = coalesce(hidden_at, now()),
      hidden_by = coalesce(hidden_by, p_actor),
      hidden_reason = why
  where id = p_recipe;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'hide', p_recipe::text,
    jsonb_build_object('hidden', rec.hidden_at is not null),
    jsonb_build_object('hidden', true, 'reason', why)
  );
  return rec.slug;
end;
$$;

create or replace function public.admin_unhide_recipe_as(
  p_actor uuid,
  p_recipe bigint,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
begin
  if not public.staff_can(p_actor, 'recipes.hide') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.recipes
  set hidden_at = null, hidden_by = null, hidden_reason = null
  where id = p_recipe;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'unhide', p_recipe::text,
    jsonb_build_object('hidden', rec.hidden_at is not null),
    jsonb_build_object('hidden', false)
  );
  return rec.slug;
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_list_recipes(
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 50,
  p_after_created timestamp with time zone default null,
  p_after_id bigint default null
)
returns setof public.admin_recipe_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_recipes_as(auth.uid(), p_query, p_filter, p_limit, p_after_created, p_after_id)
$$;

create or replace function public.admin_get_recipe(p_recipe bigint)
returns setof public.admin_recipe_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_get_recipe_as(auth.uid(), p_recipe)
$$;

create or replace function public.admin_hide_recipe(p_recipe bigint, p_reason text default null)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_hide_recipe_as(auth.uid(), p_recipe, p_reason, 'panel', null)
$$;

create or replace function public.admin_unhide_recipe(p_recipe bigint)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_unhide_recipe_as(auth.uid(), p_recipe, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.recipe_hidden_for_viewer(text) from public, anon, authenticated;
revoke all on function public.admin_recipe_rows(uuid, text, text, bigint, integer, timestamp with time zone, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_recipes_as(uuid, text, text, integer, timestamp with time zone, bigint) from public, anon, authenticated;
revoke all on function public.admin_get_recipe_as(uuid, bigint) from public, anon, authenticated;
revoke all on function public.admin_hide_recipe_as(uuid, bigint, text, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_unhide_recipe_as(uuid, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_recipes(text, text, integer, timestamp with time zone, bigint) from public, anon, authenticated;
revoke all on function public.admin_get_recipe(bigint) from public, anon, authenticated;
revoke all on function public.admin_hide_recipe(bigint, text) from public, anon, authenticated;
revoke all on function public.admin_unhide_recipe(bigint) from public, anon, authenticated;

grant execute on function public.recipe_hidden_for_viewer(text) to authenticated;
grant execute on function public.admin_list_recipes_as(uuid, text, text, integer, timestamp with time zone, bigint) to service_role;
grant execute on function public.admin_get_recipe_as(uuid, bigint) to service_role;
grant execute on function public.admin_hide_recipe_as(uuid, bigint, text, text, bigint) to service_role;
grant execute on function public.admin_unhide_recipe_as(uuid, bigint, text, bigint) to service_role;
grant execute on function public.admin_list_recipes(text, text, integer, timestamp with time zone, bigint) to authenticated;
grant execute on function public.admin_get_recipe(bigint) to authenticated;
grant execute on function public.admin_hide_recipe(bigint, text) to authenticated;
grant execute on function public.admin_unhide_recipe(bigint) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_recipe_hiding_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_recipe_rows(uuid,text,text,bigint,integer,timestamp with time zone,bigint)',
    'public.admin_list_recipes_as(uuid,text,text,integer,timestamp with time zone,bigint)',
    'public.admin_get_recipe_as(uuid,bigint)',
    'public.admin_hide_recipe_as(uuid,bigint,text,text,bigint)',
    'public.admin_unhide_recipe_as(uuid,bigint,text,bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin recipe hiding grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_list_recipes(text,text,integer,timestamp with time zone,bigint)',
    'public.admin_get_recipe(bigint)',
    'public.admin_hide_recipe(bigint,text)',
    'public.admin_unhide_recipe(bigint)',
    'public.recipe_hidden_for_viewer(text)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin recipe hiding grant check: anon can execute %', f;
    end if;
  end loop;
  -- The staff policy must not have widened writes: no policy of ours is for insert/update/delete,
  -- and authenticated still cannot write recipes at all.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'recipes_staff_select' and cmd <> 'SELECT'
  ) then
    raise exception 'admin recipe hiding grant check: recipes_staff_select is not SELECT-only';
  end if;
  -- (20261020190000 revoked insert and update from authenticated; RLS covers anon.)
  if has_table_privilege('authenticated', 'public.recipes', 'insert,update') then
    raise exception 'admin recipe hiding grant check: authenticated can write recipes directly';
  end if;
end;
$$;

revoke all on function public.assert_admin_recipe_hiding_grants() from public, anon, authenticated;

select public.assert_admin_recipe_hiding_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- Re-run the view block of 20261028160000_public_author_gender_neutral.sql (without the
-- hidden_at filter) and re-create recipe_gallery_images from 20261016180000, then
-- re-run 20261020200000_public_views_allowlist_guard.sql to restore the old assertion.
-- Then:
-- drop function public.assert_admin_recipe_hiding_grants(), public.admin_unhide_recipe(bigint),
--   public.admin_hide_recipe(bigint, text), public.admin_get_recipe(bigint),
--   public.admin_list_recipes(text, text, integer, timestamp with time zone, bigint),
--   public.admin_unhide_recipe_as(uuid, bigint, text, bigint), public.admin_hide_recipe_as(uuid, bigint, text, text, bigint),
--   public.admin_get_recipe_as(uuid, bigint), public.admin_list_recipes_as(uuid, text, text, integer, timestamp with time zone, bigint),
--   public.admin_recipe_rows(uuid, text, text, bigint, integer, timestamp with time zone, bigint),
--   public.recipe_hidden_for_viewer(text);
-- drop type public.admin_recipe_row;
-- drop policy recipes_staff_select on public.recipes;
-- alter table public.recipes drop column hidden_at, drop column hidden_by, drop column hidden_reason;
