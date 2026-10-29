-- Admin panel, Phase 2 — merging duplicate recipes by hand, and undoing it.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (API Contracts, Recipes)
--
-- Merge wraps collapse_recipe_group (20261017100000) unchanged: favorites, shares and
-- the text fingerprint of every loser move to the canonical recipe, the loser is archived
-- in recipes_merged_duplicates and every side effect lands in recipe_merge_log under one
-- merge_id. The old URL of each loser answers with a 301 to the canonical recipe.
--
-- Unmerge is NOT a call to restore_recipe_merge. That function refuses to run while the
-- global unique indexes on source_url and source_fingerprint exist
-- (20261017110000), and they exist for good, so it could never succeed here. admin_unmerge_as
-- undoes the same log in the same order, with two differences made necessary by those
-- indexes and by the global unique slug (20261017120100):
--   * a restored loser keeps its source link and fingerprint only when nobody holds them;
--     the canonical recipe usually does (that is what made it a duplicate), so a restored
--     loser typically comes back WITHOUT a link. The audit row says which fields were dropped.
--   * a slug taken since gets a "-restored-N" suffix, logged like restore_recipe_merge does.
--
-- Only the canonical may not be hidden at merge time: a redirect that lands on a hidden
-- recipe would 404 anyway, so the merge is refused and staff unhide it first.
--
-- Requires 20261029100000 (hidden_at) and 20261017100000. Applied only with the owner's
-- explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

-- ── Row type ────────────────────────────────────────────────────────────────

do $$
begin
  create type public.admin_merge_row as (
    merge_id uuid,
    merged_at timestamp with time zone,
    loser_ids bigint[],
    loser_slugs text[]
  );
exception when duplicate_object then null;
end $$;

-- ── Read ────────────────────────────────────────────────────────────────────

-- Merges whose canonical is `p_canonical`, newest first, so staff can undo one.
create or replace function public.admin_list_merges_as(p_actor uuid, p_canonical bigint)
returns setof public.admin_merge_row
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
    select
      d.merge_id,
      max(d.merged_at),
      array_agg(d.id order by d.id),
      array_agg(d.slug order by d.id)
    from public.recipes_merged_duplicates d
    where d.canonical_id = p_canonical
    group by d.merge_id
    order by max(d.merged_at) desc;
end;
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

-- Returns {merge_id, canonical_slug, loser_slugs} so the caller can invalidate caches.
create or replace function public.admin_merge_recipes_as(
  p_actor uuid,
  p_canonical bigint,
  p_losers bigint[],
  p_via text default 'panel',
  p_token_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical public.recipes%rowtype;
  loser_slugs text[];
  new_merge uuid := gen_random_uuid();
begin
  if not public.staff_can(p_actor, 'recipes.merge') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_canonical is null or p_losers is null
     or coalesce(cardinality(p_losers), 0) not between 1 and 20
     or p_canonical = any (p_losers)
     or (select count(distinct x) from unnest(p_losers) as x) <> cardinality(p_losers)
     or null = any (p_losers) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select * into canonical from public.recipes where id = p_canonical for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if canonical.hidden_at is not null then
    raise exception 'canonical_hidden' using errcode = '22023';
  end if;

  select array_agg(slug order by id) into loser_slugs from public.recipes where id = any (p_losers);
  if coalesce(cardinality(loser_slugs), 0) <> cardinality(p_losers) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  perform public.collapse_recipe_group(p_canonical, p_losers, new_merge);

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'merge', p_canonical::text,
    jsonb_build_object('losers', to_jsonb(p_losers)),
    jsonb_build_object('merge_id', new_merge)
  );
  return jsonb_build_object(
    'merge_id', new_merge,
    'canonical_slug', canonical.slug,
    'loser_slugs', to_jsonb(loser_slugs)
  );
end;
$$;

-- Returns {restored_slugs}. Undoes one merge exactly as restore_recipe_merge would, bar
-- the link handling described in the header.
create or replace function public.admin_unmerge_as(
  p_actor uuid,
  p_merge uuid,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  archived record;
  restored public.recipes%rowtype;
  slug_try text;
  suffix integer;
  slugs text[] := '{}';
  dropped jsonb := '[]'::jsonb;
  canonical_id bigint;
begin
  if not public.staff_can(p_actor, 'recipes.merge') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_merge is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select d.canonical_id into canonical_id
  from public.recipes_merged_duplicates d where d.merge_id = p_merge limit 1;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Serialize with other merges of the same run: the log is undone in reverse order.
  perform pg_advisory_xact_lock(hashtext('admin_merge:' || p_merge::text));

  -- 5. The canonical gives back a fingerprint it inherited from a loser.
  for entry in
    select * from public.recipe_merge_log where merge_id = p_merge and kind = 'fingerprint_copied' order by id desc
  loop
    update public.recipes set source_fingerprint = entry.old_value ->> 'source_fingerprint'
    where id = entry.ref_id::bigint;
  end loop;

  -- 6. The losers come back with their ids.
  for archived in select * from public.recipes_merged_duplicates where merge_id = p_merge order by id loop
    restored := jsonb_populate_record(null::public.recipes, archived.row_data);

    slug_try := restored.slug;
    suffix := 0;
    while exists (select 1 from public.recipes where slug = slug_try) loop
      suffix := suffix + 1;
      slug_try := restored.slug || '-restored-' || suffix;
    end loop;
    if slug_try <> restored.slug then
      insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
      values (p_merge, 'slug_restored', restored.id::text,
              jsonb_build_object('slug', restored.slug), jsonb_build_object('slug', slug_try));
      restored.slug := slug_try;
    end if;

    -- The global unique indexes: keep the link / fingerprint only when it is free.
    if restored.source_url is not null
       and exists (select 1 from public.recipes where source_url = restored.source_url) then
      dropped := dropped || jsonb_build_object('id', restored.id, 'field', 'source_url');
      restored.source_url := null;
    end if;
    if restored.source_fingerprint is not null
       and exists (select 1 from public.recipes where source_fingerprint = restored.source_fingerprint) then
      dropped := dropped || jsonb_build_object('id', restored.id, 'field', 'source_fingerprint');
      restored.source_fingerprint := null;
    end if;

    insert into public.recipes select (restored).*;
    slugs := slugs || restored.slug;
  end loop;

  -- 4, 3. Shares back to where they were.
  for entry in
    select * from public.recipe_merge_log
    where merge_id = p_merge and kind in ('failed_share_completed', 'share_repoint') order by id desc
  loop
    if entry.kind = 'failed_share_completed' then
      update public.recipe_shares
      set status = (entry.old_value ->> 'status')::public.recipe_share_status,
          recipe_id = (entry.old_value ->> 'recipe_id')::bigint
      where id = entry.ref_id::bigint;
    else
      update public.recipe_shares set recipe_id = (entry.old_value ->> 'recipe_id')::bigint
      where id = entry.ref_id::bigint;
    end if;
  end loop;

  -- 2, 1. Favorites: the created ones go, the moved ones move back, the dropped ones
  --       return. Favorites added since the merge are untouched.
  for entry in
    select * from public.recipe_merge_log
    where merge_id = p_merge and kind in ('favorite_created', 'favorite_repoint', 'favorite_deleted') order by id desc
  loop
    if entry.kind = 'favorite_created' then
      delete from public.favorites
      where user_id = entry.ref_id::uuid and recipe_id = (entry.new_value ->> 'recipe_id')::bigint;
    elsif entry.kind = 'favorite_repoint' then
      update public.favorites set recipe_id = (entry.old_value ->> 'recipe_id')::bigint
      where user_id = entry.ref_id::uuid and recipe_id = (entry.new_value ->> 'recipe_id')::bigint;
    else
      insert into public.favorites (user_id, recipe_id, created_at)
      values (entry.ref_id::uuid, (entry.old_value ->> 'recipe_id')::bigint, (entry.old_value ->> 'created_at')::timestamptz)
      on conflict do nothing;
    end if;
  end loop;

  delete from public.recipes_merged_duplicates where merge_id = p_merge;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'recipes', 'unmerge', canonical_id::text,
    jsonb_build_object('merge_id', p_merge),
    jsonb_build_object('restored', cardinality(slugs), 'dropped', dropped)
  );
  return jsonb_build_object('canonical_id', canonical_id, 'restored_slugs', to_jsonb(slugs));
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_list_merges(p_canonical bigint)
returns setof public.admin_merge_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_merges_as(auth.uid(), p_canonical)
$$;

create or replace function public.admin_merge_recipes(p_canonical bigint, p_losers bigint[])
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.admin_merge_recipes_as(auth.uid(), p_canonical, p_losers, 'panel', null)
$$;

create or replace function public.admin_unmerge(p_merge uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.admin_unmerge_as(auth.uid(), p_merge, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_list_merges_as(uuid, bigint) from public, anon, authenticated;
revoke all on function public.admin_merge_recipes_as(uuid, bigint, bigint[], text, bigint) from public, anon, authenticated;
revoke all on function public.admin_unmerge_as(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_merges(bigint) from public, anon, authenticated;
revoke all on function public.admin_merge_recipes(bigint, bigint[]) from public, anon, authenticated;
revoke all on function public.admin_unmerge(uuid) from public, anon, authenticated;

grant execute on function public.admin_list_merges_as(uuid, bigint) to service_role;
grant execute on function public.admin_merge_recipes_as(uuid, bigint, bigint[], text, bigint) to service_role;
grant execute on function public.admin_unmerge_as(uuid, uuid, text, bigint) to service_role;
grant execute on function public.admin_list_merges(bigint) to authenticated;
grant execute on function public.admin_merge_recipes(bigint, bigint[]) to authenticated;
grant execute on function public.admin_unmerge(uuid) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_recipe_merge_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_list_merges_as(uuid,bigint)',
    'public.admin_merge_recipes_as(uuid,bigint,bigint[],text,bigint)',
    'public.admin_unmerge_as(uuid,uuid,text,bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin recipe merge grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_list_merges(bigint)',
    'public.admin_merge_recipes(bigint,bigint[])',
    'public.admin_unmerge(uuid)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin recipe merge grant check: anon can execute %', f;
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_admin_recipe_merge_grants() from public, anon, authenticated;

select public.assert_admin_recipe_merge_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_recipe_merge_grants(), public.admin_unmerge(uuid),
--   public.admin_merge_recipes(bigint, bigint[]), public.admin_list_merges(bigint),
--   public.admin_unmerge_as(uuid, uuid, text, bigint),
--   public.admin_merge_recipes_as(uuid, bigint, bigint[], text, bigint),
--   public.admin_list_merges_as(uuid, bigint);
-- drop type public.admin_merge_row;
