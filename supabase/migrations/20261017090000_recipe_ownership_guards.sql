-- E01-S03a (Phase 1) — ownership guards for "one recipe per link".
-- A recipe belongs to whoever added it first; everyone else who adds the link
-- gets it as a favorite. These guards make sure such a recipe cannot vanish
-- from under them. They ship before any data change (spec R-H6) and change no
-- rows themselves.
--
-- Both functions are SECURITY DEFINER: favorites is owner-only under RLS, so as
-- the deleting user they would see only that user's own favorites and never
-- find anyone else's.
--
-- Opt-out: a transaction that has already moved favorites or ownership off a
-- recipe (account deletion below; the one-off duplicate collapse later) sets
--   set_config('zapiszprzepis.allow_shared_recipe_delete', 'on', true)
-- which is transaction-local.
--
-- Rollback: drop trigger transfer_recipes_on_account_delete on auth.users;
-- drop trigger recipes_block_shared_delete on public.recipes; drop both
-- functions. Nothing here changes rows, so nothing needs restoring.

-- 1. The owner cannot delete a recipe others keep as a favorite (decision Q4).
--    The delete route maps the error to 409 and leaves storage untouched.
create function public.recipes_block_shared_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('zapiszprzepis.allow_shared_recipe_delete', true), '') = 'on' then
    return old;
  end if;

  if exists (
    select 1
    from public.favorites f
    where f.recipe_id = old.id
      and f.user_id <> old.user_id
  ) then
    raise exception 'recipe_shared'
      using errcode = 'P0001',
            hint = 'Other users have this recipe as a favorite.';
  end if;

  return old;
end;
$$;

comment on function public.recipes_block_shared_delete() is
  'E01-S03a: refuses deleting a recipe that users other than its owner have as a favorite.';

-- A trigger function only runs through its trigger.
revoke all on function public.recipes_block_shared_delete() from public, anon, authenticated;

create trigger recipes_block_shared_delete
  before delete on public.recipes
  for each row execute function public.recipes_block_shared_delete();

-- 2. Deleting an account hands each recipe others favorited to the oldest such
--    favoriter, so it survives (decision Q6). Recipes nobody else has go with
--    the account through the existing cascade, as before.
create function public.transfer_recipes_on_account_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shared record;
  heir uuid;
begin
  -- The cascade that follows deletes what is left of this account's recipes.
  -- A recipe that found no heir below (every favoriter keeps a copy of the
  -- link of their own) must go with it rather than block the account delete.
  perform set_config('zapiszprzepis.allow_shared_recipe_delete', 'on', true);

  for shared in
    select r.id, r.slug, r.source_url, r.source_fingerprint
    from public.recipes r
    where r.user_id = old.id
      and exists (
        select 1 from public.favorites f where f.recipe_id = r.id and f.user_id <> old.id
      )
  loop
    -- The oldest favoriter without their own copy of this link: a copy would
    -- collide on the per-user unique indexes, and they keep it anyway.
    select f.user_id into heir
    from public.favorites f
    where f.recipe_id = shared.id
      and f.user_id <> old.id
      and not exists (
        select 1
        from public.recipes own
        where own.user_id = f.user_id
          and (
            (shared.source_url is not null and own.source_url = shared.source_url)
            or (shared.source_fingerprint is not null and own.source_fingerprint = shared.source_fingerprint)
          )
      )
    order by f.created_at, f.user_id
    limit 1;

    continue when heir is null;

    update public.recipes r
    set user_id = heir,
        -- Slugs are unique per user: never take a slug the heir already uses.
        slug = case
          when exists (select 1 from public.recipes o where o.user_id = heir and o.slug = shared.slug)
            then shared.slug || '-' || shared.id
          else shared.slug
        end
    where r.id = shared.id;

    -- The heir now owns it; it moves from their favorites to their recipes.
    delete from public.favorites f where f.user_id = heir and f.recipe_id = shared.id;
  end loop;

  return old;
end;
$$;

comment on function public.transfer_recipes_on_account_delete() is
  'E01-S03a (Q6): before an account is deleted, hands its recipes others favorited to the oldest favoriter.';

revoke all on function public.transfer_recipes_on_account_delete() from public, anon, authenticated;

create trigger transfer_recipes_on_account_delete
  before delete on auth.users
  for each row execute function public.transfer_recipes_on_account_delete();
