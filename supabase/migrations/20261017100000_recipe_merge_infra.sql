-- E01-S03a (Phase 2) — infrastructure for the one-off collapse of duplicate
-- recipes (one recipe per link). Schema and functions only: no data changes
-- and no data assertions, so it is safe on `db reset`. The collapse itself is
-- run by scripts/collapse-duplicate-recipes.ts (--dry-run, then --apply after
-- the owner reviews the report).
--
-- Exactly reversible while the archive exists: every side effect is written to
-- recipe_merge_log and undone by restore_recipe_merge(merge_id).
--
-- Rollback (before any collapse ran): drop the four functions, then
-- recipe_merge_log and recipes_merged_duplicates.

do $guard$
begin
  if to_regclass('public.favorites') is null then
    raise exception 'public.favorites is missing: E01-S06 (favorites) must ship first';
  end if;
end;
$guard$;

-- Losers of the collapse, as they were. The plain column copy is for reading;
-- row_data is the full row, which restore uses so a column added to recipes
-- later is neither lost nor a mismatch. No indexes, no nextval default.
create table public.recipes_merged_duplicates as
select * from public.recipes where false;

alter table public.recipes_merged_duplicates
  add column row_data jsonb not null,
  add column canonical_id bigint not null,
  add column merge_id uuid not null,
  add column merged_at timestamp with time zone not null default now();

comment on table public.recipes_merged_duplicates is
  'E01-S03a: recipe rows removed by the duplicate collapse, kept for restore_recipe_merge. Service-only.';

create table public.recipe_merge_log (
  id bigint generated always as identity primary key,
  merge_id uuid not null,
  kind text not null check (kind in (
    'share_repoint', 'favorite_repoint', 'favorite_deleted',
    'favorite_created', 'failed_share_completed', 'fingerprint_copied', 'slug_restored'
  )),
  ref_id text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone not null default now()
);

create index recipe_merge_log_merge_id_idx on public.recipe_merge_log (merge_id);

comment on table public.recipe_merge_log is
  'E01-S03a: every side effect of the duplicate collapse, so restore_recipe_merge is exact. Service-only.';

-- Service-only: RLS on, no policies, no grants to the API roles.
alter table public.recipes_merged_duplicates enable row level security;
alter table public.recipe_merge_log enable row level security;
revoke all on public.recipes_merged_duplicates from anon, authenticated;
revoke all on public.recipe_merge_log from anon, authenticated;

-- Folds each loser into the canonical recipe, in one transaction.
create function public.collapse_recipe_group(p_canonical_id bigint, p_loser_ids bigint[], p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical public.recipes%rowtype;
  loser public.recipes%rowtype;
  loser_id bigint;
  fav record;
  share record;
begin
  -- Favorites are moved off each loser before it is deleted.
  perform set_config('zapiszprzepis.allow_shared_recipe_delete', 'on', true);

  select * into canonical from public.recipes where id = p_canonical_id for update;
  if not found then
    raise exception 'collapse: canonical recipe % does not exist', p_canonical_id;
  end if;

  foreach loser_id in array p_loser_ids loop
    if loser_id = p_canonical_id then
      raise exception 'collapse: recipe % is both canonical and loser', loser_id;
    end if;
    select * into loser from public.recipes where id = loser_id for update;
    if not found then
      raise exception 'collapse: loser recipe % does not exist', loser_id;
    end if;

    -- Archive the row as it is now, before anything below touches it.
    insert into public.recipes_merged_duplicates
    select (jsonb_populate_record(
      null::public.recipes_merged_duplicates,
      to_jsonb(loser) || jsonb_build_object(
        'row_data', to_jsonb(loser),
        'canonical_id', p_canonical_id,
        'merge_id', p_merge_id,
        'merged_at', now()
      )
    )).*;

    -- 1. Favorites of the loser move to the canonical; one the user already
    --    has there makes the loser's a duplicate, which is dropped.
    for fav in select * from public.favorites where recipe_id = loser_id loop
      if exists (select 1 from public.favorites where user_id = fav.user_id and recipe_id = p_canonical_id) then
        delete from public.favorites where user_id = fav.user_id and recipe_id = loser_id;
        insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
        values (p_merge_id, 'favorite_deleted', fav.user_id::text,
                jsonb_build_object('recipe_id', loser_id, 'created_at', fav.created_at), null);
      else
        update public.favorites set recipe_id = p_canonical_id where user_id = fav.user_id and recipe_id = loser_id;
        insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
        values (p_merge_id, 'favorite_repoint', fav.user_id::text,
                jsonb_build_object('recipe_id', loser_id), jsonb_build_object('recipe_id', p_canonical_id));
      end if;
    end loop;

    -- 2. The loser's owner keeps the recipe, as a favorite. Not when they own
    --    the canonical too (two keys of one Facebook post): it is theirs.
    if loser.user_id <> canonical.user_id then
      insert into public.favorites (user_id, recipe_id) values (loser.user_id, p_canonical_id)
      on conflict do nothing;
      if found then
        insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
        values (p_merge_id, 'favorite_created', loser.user_id::text, null, jsonb_build_object('recipe_id', p_canonical_id));
      end if;
    end if;

    -- 3. Every share that produced the loser now points at the canonical.
    for share in select id from public.recipe_shares where recipe_id = loser_id loop
      update public.recipe_shares set recipe_id = p_canonical_id where id = share.id;
      insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
      values (p_merge_id, 'share_repoint', share.id::text,
              jsonb_build_object('recipe_id', loser_id), jsonb_build_object('recipe_id', p_canonical_id));
    end loop;

    -- 4. The loser owner's failed shares of the link are settled on it.
    for share in
      select id, recipe_id from public.recipe_shares
      where user_id = loser.user_id and status = 'failed' and shared_url = loser.source_url
    loop
      update public.recipe_shares set status = 'completed', recipe_id = p_canonical_id where id = share.id;
      insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
      values (p_merge_id, 'failed_share_completed', share.id::text,
              jsonb_build_object('status', 'failed', 'recipe_id', share.recipe_id),
              jsonb_build_object('status', 'completed', 'recipe_id', p_canonical_id));
    end loop;

    -- 5. The canonical inherits the loser's text fingerprint when it has none.
    --    The loser's is cleared first: the same user may own both rows.
    if loser.source_fingerprint is not null then
      update public.recipes set source_fingerprint = null where id = loser_id;
      if canonical.source_fingerprint is null then
        update public.recipes set source_fingerprint = loser.source_fingerprint where id = p_canonical_id;
        canonical.source_fingerprint := loser.source_fingerprint;
        insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
        values (p_merge_id, 'fingerprint_copied', p_canonical_id::text,
                jsonb_build_object('source_fingerprint', null),
                jsonb_build_object('source_fingerprint', loser.source_fingerprint));
      end if;
    end if;

    -- 6. The loser leaves recipes (it is archived above).
    delete from public.recipes where id = loser_id;
  end loop;
end;
$$;

-- All groups of one run, in one transaction (one RPC call).
create function public.collapse_recipe_groups(p_groups jsonb, p_merge_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  grp jsonb;
  n integer := 0;
begin
  for grp in select * from jsonb_array_elements(p_groups) loop
    perform public.collapse_recipe_group(
      (grp ->> 'canonical_id')::bigint,
      array(select jsonb_array_elements_text(grp -> 'loser_ids')::bigint),
      p_merge_id
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- The exact inverse of one collapse run. Precondition: migration B's down has
-- dropped the global unique indexes (the restored rows duplicate links).
create function public.restore_recipe_merge(p_merge_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  archived record;
  restored public.recipes%rowtype;
  slug_try text;
  n integer := 0;
  suffix integer;
begin
  if to_regclass('public.recipes_source_url_uniq') is not null
     or to_regclass('public.recipes_source_fingerprint_uniq') is not null then
    raise exception 'restore: drop the global unique indexes first (migration B down)';
  end if;

  -- 5. Fingerprints back first: a restored loser may share one with its canonical's owner.
  for entry in select * from public.recipe_merge_log where merge_id = p_merge_id and kind = 'fingerprint_copied' order by id desc loop
    update public.recipes set source_fingerprint = entry.old_value ->> 'source_fingerprint'
    where id = entry.ref_id::bigint;
  end loop;

  -- 6. The losers come back with their ids. A slug the owner has used since
  --    gets a "-restored-N" suffix, logged.
  for archived in select * from public.recipes_merged_duplicates where merge_id = p_merge_id order by id loop
    restored := jsonb_populate_record(null::public.recipes, archived.row_data);
    slug_try := restored.slug;
    suffix := 0;
    while exists (select 1 from public.recipes where user_id = restored.user_id and slug = slug_try) loop
      suffix := suffix + 1;
      slug_try := restored.slug || '-restored-' || suffix;
    end loop;
    if slug_try <> restored.slug then
      insert into public.recipe_merge_log (merge_id, kind, ref_id, old_value, new_value)
      values (p_merge_id, 'slug_restored', restored.id::text,
              jsonb_build_object('slug', restored.slug), jsonb_build_object('slug', slug_try));
      restored.slug := slug_try;
    end if;
    insert into public.recipes select (restored).*;
    n := n + 1;
  end loop;

  -- 4, 3. Shares back to where they were.
  for entry in select * from public.recipe_merge_log
    where merge_id = p_merge_id and kind in ('failed_share_completed', 'share_repoint') order by id desc loop
    if entry.kind = 'failed_share_completed' then
      update public.recipe_shares
      set status = (entry.old_value ->> 'status')::public.recipe_share_status, recipe_id = (entry.old_value ->> 'recipe_id')::bigint
      where id = entry.ref_id::bigint;
    else
      update public.recipe_shares set recipe_id = (entry.old_value ->> 'recipe_id')::bigint
      where id = entry.ref_id::bigint;
    end if;
  end loop;

  -- 2, 1. Favorites: the created ones go, the moved ones move back, the
  --       dropped ones return. Favorites added since the merge are untouched.
  for entry in select * from public.recipe_merge_log
    where merge_id = p_merge_id and kind in ('favorite_created', 'favorite_repoint', 'favorite_deleted') order by id desc loop
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

  delete from public.recipes_merged_duplicates where merge_id = p_merge_id;
  return n;
end;
$$;

revoke all on function public.collapse_recipe_group(bigint, bigint[], uuid) from public, anon, authenticated;
revoke all on function public.collapse_recipe_groups(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.restore_recipe_merge(uuid) from public, anon, authenticated;
grant execute on function public.collapse_recipe_group(bigint, bigint[], uuid) to service_role;
grant execute on function public.collapse_recipe_groups(jsonb, uuid) to service_role;
grant execute on function public.restore_recipe_merge(uuid) to service_role;
