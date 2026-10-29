-- Admin panel, Phase 2 — staff delete of a recipe, with an archive and a restore.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (Q7, API Contracts, Edge Cases)
--
-- A staff delete is a hard delete with a copy: the full row goes to
-- recipes_deleted_by_staff first (service-only, the shape of recipes_merged_duplicates),
-- inside the same transaction as the delete and the audit row. An optional redirect slug
-- gives the old URL a 301 to another recipe; without one the URL answers 404.
--
-- Favorites of the deleted recipe go with it (ON DELETE CASCADE): the function sets
-- zapiszprzepis.allow_shared_recipe_delete for its transaction, which opts out of
-- recipes_block_shared_delete (the guard that stops an OWNER deleting a recipe others
-- favorited). recipe_shares.recipe_id becomes NULL (ON DELETE SET NULL). Neither is
-- restored by admin_restore_recipe_as; the audit row records how many favorites were lost.
--
-- Restore puts the row back under its old id and slug and removes the archive row. It
-- refuses when the slug or the source link is taken again, or the owner's account is gone.
--
-- The redirect lookup (findMergedRecipeSlug) reads this table with the service key and
-- must never resolve to a hidden recipe; that lives in the app (src/lib/merged-recipe-redirect.ts).
--
-- Requires 20261029100000. Applied only with the owner's explicit go (local development
-- points at the production database).
--
-- Idempotent: safe to re-run.

-- ── Archive ─────────────────────────────────────────────────────────────────

create table if not exists public.recipes_deleted_by_staff (
  id bigint generated always as identity primary key,
  recipe_id bigint not null,
  slug text not null,
  title text not null,
  -- The full row, so restore is exact and a column added to recipes later is not lost.
  row_data jsonb not null,
  deleted_by uuid not null,
  deleted_at timestamp with time zone not null default now(),
  redirect_to_slug text,
  favorite_count integer not null default 0
);

create index if not exists idx_recipes_deleted_by_staff_slug on public.recipes_deleted_by_staff (slug);
create index if not exists idx_recipes_deleted_by_staff_recipe on public.recipes_deleted_by_staff (recipe_id);

comment on table public.recipes_deleted_by_staff is
  'Admin panel: recipes deleted by staff, kept for admin_restore_recipe_as and for the 301 lookup. Service-only.';

alter table public.recipes_deleted_by_staff enable row level security;
revoke all on public.recipes_deleted_by_staff from anon, authenticated;

-- ── Row type ────────────────────────────────────────────────────────────────

do $$
begin
  create type public.admin_deleted_recipe_row as (
    recipe_id bigint,
    slug text,
    title text,
    deleted_at timestamp with time zone,
    redirect_to_slug text,
    favorite_count integer
  );
exception when duplicate_object then null;
end $$;

-- ── Read ────────────────────────────────────────────────────────────────────

create or replace function public.admin_list_deleted_recipes_as(p_actor uuid, p_limit integer default 50)
returns setof public.admin_deleted_recipe_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.staff_can(p_actor, 'recipes.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select d.recipe_id, d.slug, d.title, d.deleted_at, d.redirect_to_slug, d.favorite_count
    from public.recipes_deleted_by_staff d
    order by d.deleted_at desc, d.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

-- Returns the slug that was deleted, for cache invalidation after the commit.
create or replace function public.admin_delete_recipe_as(
  p_actor uuid,
  p_recipe bigint,
  p_redirect_to_slug text default null,
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
  target text := nullif(btrim(coalesce(p_redirect_to_slug, '')), '');
  n_favorites integer;
begin
  if not public.staff_can(p_actor, 'recipes.delete') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- A redirect must land on a recipe guests can open.
  if target is not null and not exists (
    select 1 from public.recipes where slug = target and id <> p_recipe and hidden_at is null
  ) then
    raise exception 'invalid_redirect' using errcode = '22023';
  end if;

  select count(*) into n_favorites from public.favorites where recipe_id = p_recipe;

  insert into public.recipes_deleted_by_staff (recipe_id, slug, title, row_data, deleted_by, redirect_to_slug, favorite_count)
  values (rec.id, rec.slug, rec.title, to_jsonb(rec), p_actor, target, n_favorites);

  -- Favorites cascade with the row; the owner guard is for owners only.
  perform set_config('zapiszprzepis.allow_shared_recipe_delete', 'on', true);
  delete from public.recipes where id = p_recipe;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'delete', p_recipe::text,
    jsonb_build_object('slug', rec.slug, 'favorites', n_favorites, 'hidden', rec.hidden_at is not null),
    jsonb_build_object('deleted', true, 'redirect_to', target)
  );
  return rec.slug;
end;
$$;

-- Returns the restored slug. The archive row goes once the recipe is back.
create or replace function public.admin_restore_recipe_as(
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
  archived public.recipes_deleted_by_staff%rowtype;
  restored public.recipes%rowtype;
begin
  if not public.staff_can(p_actor, 'recipes.delete') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into archived
  from public.recipes_deleted_by_staff
  where recipe_id = p_recipe
  order by deleted_at desc, id desc
  limit 1
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.recipes where id = p_recipe) then
    raise exception 'restore_conflict' using errcode = '23505';
  end if;
  if exists (select 1 from public.recipes where slug = archived.slug) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  restored := jsonb_populate_record(null::public.recipes, archived.row_data);
  begin
    insert into public.recipes select (restored).*;
  exception
    when unique_violation or foreign_key_violation then
      -- The source link or text fingerprint is taken again, or the owner's account is gone.
      raise exception 'restore_conflict' using errcode = '23505';
  end;

  delete from public.recipes_deleted_by_staff where id = archived.id;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'restore', p_recipe::text,
    jsonb_build_object('deleted', true),
    jsonb_build_object('deleted', false, 'slug', archived.slug, 'favorites_lost', archived.favorite_count)
  );
  return archived.slug;
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_list_deleted_recipes(p_limit integer default 50)
returns setof public.admin_deleted_recipe_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_deleted_recipes_as(auth.uid(), p_limit)
$$;

create or replace function public.admin_delete_recipe(p_recipe bigint, p_redirect_to_slug text default null)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_delete_recipe_as(auth.uid(), p_recipe, p_redirect_to_slug, 'panel', null)
$$;

create or replace function public.admin_restore_recipe(p_recipe bigint)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_restore_recipe_as(auth.uid(), p_recipe, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_list_deleted_recipes_as(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_delete_recipe_as(uuid, bigint, text, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_restore_recipe_as(uuid, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_deleted_recipes(integer) from public, anon, authenticated;
revoke all on function public.admin_delete_recipe(bigint, text) from public, anon, authenticated;
revoke all on function public.admin_restore_recipe(bigint) from public, anon, authenticated;

grant execute on function public.admin_list_deleted_recipes_as(uuid, integer) to service_role;
grant execute on function public.admin_delete_recipe_as(uuid, bigint, text, text, bigint) to service_role;
grant execute on function public.admin_restore_recipe_as(uuid, bigint, text, bigint) to service_role;
grant execute on function public.admin_list_deleted_recipes(integer) to authenticated;
grant execute on function public.admin_delete_recipe(bigint, text) to authenticated;
grant execute on function public.admin_restore_recipe(bigint) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_recipe_delete_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  if has_table_privilege('anon', 'public.recipes_deleted_by_staff', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.recipes_deleted_by_staff', 'select,insert,update,delete') then
    raise exception 'admin recipe delete grant check: recipes_deleted_by_staff is reachable through the API';
  end if;
  foreach f in array array[
    'public.admin_list_deleted_recipes_as(uuid,integer)',
    'public.admin_delete_recipe_as(uuid,bigint,text,text,bigint)',
    'public.admin_restore_recipe_as(uuid,bigint,text,bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin recipe delete grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_list_deleted_recipes(integer)',
    'public.admin_delete_recipe(bigint,text)',
    'public.admin_restore_recipe(bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin recipe delete grant check: anon can execute %', f;
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_admin_recipe_delete_grants() from public, anon, authenticated;

select public.assert_admin_recipe_delete_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_recipe_delete_grants(), public.admin_restore_recipe(bigint),
--   public.admin_delete_recipe(bigint, text), public.admin_list_deleted_recipes(integer),
--   public.admin_restore_recipe_as(uuid, bigint, text, bigint),
--   public.admin_delete_recipe_as(uuid, bigint, text, text, bigint),
--   public.admin_list_deleted_recipes_as(uuid, integer);
-- drop type public.admin_deleted_recipe_row;
-- Restore anything still wanted from the archive first, then: drop table public.recipes_deleted_by_staff;
