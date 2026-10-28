-- Admin panel, Phase 1 — users: list, block, unblock, delete.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (API Contracts, Users)
--
-- Every operation is two functions:
--   admin_<op>_as(p_actor, ..., p_via, p_token_id)  service_role only. Checks the
--       actor's permission, does the work and writes the audit row in ONE
--       transaction (an audit failure rolls the change back).
--   admin_<op>(...)                                 authenticated. A thin wrapper
--       that passes auth.uid(); this is what the panel calls with the user's own
--       session, so the service-role key never enters a panel request.
-- The MCP (Phase 4) calls the `_as` functions with an actor id that SQL re-checks.
--
-- Rules enforced here, not in the app:
--   * users.read lists accounts without e-mail; users.read_email adds it (and
--     only then is e-mail searched, so a search cannot leak what the column hides).
--   * nobody blocks or deletes themselves, and nobody blocks or deletes a person
--     who holds a staff role (remove the role first, admins only).
--   * blocking sets banned_until and deletes the account's sessions, so an access
--     token already issued stops being refreshable at once.
--   * deleting an account runs the existing transfer_recipes_on_account_delete
--     trigger (recipes others favorited go to the oldest favoriter). Storage
--     objects are never deleted here.
--
-- Requires 20261028100000 and 20261028110000. Applied only with the owner's
-- explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

-- ── Row type shared by list and get ────────────────────────────────────────

do $$
begin
  create type public.admin_user_row as (
    user_id uuid,
    username text,
    display_name text,
    email text,
    created_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    banned_until timestamp with time zone,
    provider text,
    recipe_count bigint,
    favorite_count bigint,
    full_access boolean,
    roles text[]
  );
exception when duplicate_object then null;
end $$;

-- ── Read ────────────────────────────────────────────────────────────────────

-- One account, in the shape the list uses. Internal helper for list and get.
create or replace function public.admin_user_rows(p_actor uuid, p_query text, p_user uuid, p_limit integer, p_after_created timestamp with time zone, p_after_id uuid)
returns setof public.admin_user_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  can_email boolean := public.staff_can(p_actor, 'users.read_email');
  q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.staff_can(p_actor, 'users.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if q is not null then
    -- Literal match: % and _ typed by staff are not wildcards.
    q := '%' || regexp_replace(q, '([\\%_])', '\\\1', 'g') || '%';
  end if;

  return query
    select
      u.id,
      p.username,
      p.display_name,
      case when can_email then u.email::text else null end,
      u.created_at,
      u.last_sign_in_at,
      u.banned_until,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
      (select count(*) from public.recipes r where r.user_id = u.id),
      (select count(*) from public.favorites f where f.user_id = u.id),
      exists (select 1 from public.user_full_access a where a.user_id = u.id),
      coalesce((select array_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = u.id), '{}'::text[])
    from auth.users u
    left join public.profiles p on p.id = u.id
    where (p_user is null or u.id = p_user)
      and (q is null
           or p.username ilike q
           or p.display_name ilike q
           or (can_email and u.email ilike q))
      and (p_after_created is null or (u.created_at, u.id) < (p_after_created, p_after_id))
    order by u.created_at desc, u.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.admin_list_users_as(
  p_actor uuid,
  p_query text default null,
  p_limit integer default 50,
  p_after_created timestamp with time zone default null,
  p_after_id uuid default null
)
returns setof public.admin_user_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_user_rows(p_actor, p_query, null, p_limit, p_after_created, p_after_id)
$$;

create or replace function public.admin_get_user_as(p_actor uuid, p_user uuid)
returns setof public.admin_user_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_user_rows(p_actor, null, p_user, 1, null, null)
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

-- Shared preconditions of block / unblock / delete.
create or replace function public.admin_user_target_check(p_actor uuid, p_user uuid, p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.staff_can(p_actor, p_permission) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_actor = p_user then
    raise exception 'cannot_target_self' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user) then
    raise exception 'cannot_target_staff' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_block_user_as(
  p_actor uuid,
  p_user uuid,
  p_reason text default null,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_user_target_check(p_actor, p_user, 'users.block');

  -- A far-future date rather than 'infinity': GoTrue parses this column as a Go time.
  update auth.users set banned_until = now() + interval '100 years' where id = p_user;
  -- Refresh tokens go with their session (cascade), so no new access token is issued.
  delete from auth.sessions where user_id = p_user;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'users', 'block', p_user::text,
    jsonb_build_object('blocked', false),
    jsonb_build_object('blocked', true, 'reason', left(nullif(btrim(coalesce(p_reason, '')), ''), 200))
  );
end;
$$;

create or replace function public.admin_unblock_user_as(
  p_actor uuid,
  p_user uuid,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_user_target_check(p_actor, p_user, 'users.block');

  update auth.users set banned_until = null where id = p_user;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'users', 'unblock', p_user::text,
    jsonb_build_object('blocked', true),
    jsonb_build_object('blocked', false)
  );
end;
$$;

create or replace function public.admin_delete_user_as(
  p_actor uuid,
  p_user uuid,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_recipes bigint;
  n_favorites bigint;
begin
  perform public.admin_user_target_check(p_actor, p_user, 'users.delete');

  select count(*) into n_recipes from public.recipes where user_id = p_user;
  select count(*) into n_favorites from public.favorites where user_id = p_user;

  -- Audited first, in the same transaction: no unaudited deletion. Ids and counts only.
  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'users', 'delete', p_user::text,
    jsonb_build_object('recipes', n_recipes, 'favorites', n_favorites),
    null
  );

  -- The BEFORE DELETE trigger transfer_recipes_on_account_delete hands over
  -- recipes others favorited; profile, shares, favorites and the rest cascade.
  delete from auth.users where id = p_user;
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_list_users(
  p_query text default null,
  p_limit integer default 50,
  p_after_created timestamp with time zone default null,
  p_after_id uuid default null
)
returns setof public.admin_user_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_users_as(auth.uid(), p_query, p_limit, p_after_created, p_after_id)
$$;

create or replace function public.admin_get_user(p_user uuid)
returns setof public.admin_user_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_get_user_as(auth.uid(), p_user)
$$;

create or replace function public.admin_block_user(p_user uuid, p_reason text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_block_user_as(auth.uid(), p_user, p_reason, 'panel', null)
$$;

create or replace function public.admin_unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_unblock_user_as(auth.uid(), p_user, 'panel', null)
$$;

create or replace function public.admin_delete_user(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_delete_user_as(auth.uid(), p_user, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_user_rows(uuid, text, uuid, integer, timestamp with time zone, uuid) from public, anon, authenticated;
revoke all on function public.admin_user_target_check(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_list_users_as(uuid, text, integer, timestamp with time zone, uuid) from public, anon, authenticated;
revoke all on function public.admin_get_user_as(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_block_user_as(uuid, uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_unblock_user_as(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_delete_user_as(uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_users(text, integer, timestamp with time zone, uuid) from public, anon, authenticated;
revoke all on function public.admin_get_user(uuid) from public, anon, authenticated;
revoke all on function public.admin_block_user(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_unblock_user(uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_user(uuid) from public, anon, authenticated;

grant execute on function public.admin_list_users_as(uuid, text, integer, timestamp with time zone, uuid) to service_role;
grant execute on function public.admin_get_user_as(uuid, uuid) to service_role;
grant execute on function public.admin_block_user_as(uuid, uuid, text, text, bigint) to service_role;
grant execute on function public.admin_unblock_user_as(uuid, uuid, text, bigint) to service_role;
grant execute on function public.admin_delete_user_as(uuid, uuid, text, bigint) to service_role;
grant execute on function public.admin_list_users(text, integer, timestamp with time zone, uuid) to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_block_user(uuid, text) to authenticated;
grant execute on function public.admin_unblock_user(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_users_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_list_users_as(uuid,text,integer,timestamp with time zone,uuid)',
    'public.admin_get_user_as(uuid,uuid)',
    'public.admin_block_user_as(uuid,uuid,text,text,bigint)',
    'public.admin_unblock_user_as(uuid,uuid,text,bigint)',
    'public.admin_delete_user_as(uuid,uuid,text,bigint)',
    'public.admin_user_rows(uuid,text,uuid,integer,timestamp with time zone,uuid)',
    'public.admin_user_target_check(uuid,uuid,text)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin users grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_list_users(text,integer,timestamp with time zone,uuid)',
    'public.admin_get_user(uuid)',
    'public.admin_block_user(uuid,text)',
    'public.admin_unblock_user(uuid)',
    'public.admin_delete_user(uuid)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin users grant check: anon can execute %', f;
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_admin_users_grants() from public, anon, authenticated;

select public.assert_admin_users_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_users_grants(), public.admin_delete_user(uuid),
--   public.admin_unblock_user(uuid), public.admin_block_user(uuid, text), public.admin_get_user(uuid),
--   public.admin_list_users(text, integer, timestamp with time zone, uuid),
--   public.admin_delete_user_as(uuid, uuid, text, bigint), public.admin_unblock_user_as(uuid, uuid, text, bigint),
--   public.admin_block_user_as(uuid, uuid, text, text, bigint), public.admin_user_target_check(uuid, uuid, text),
--   public.admin_get_user_as(uuid, uuid), public.admin_list_users_as(uuid, text, integer, timestamp with time zone, uuid),
--   public.admin_user_rows(uuid, text, uuid, integer, timestamp with time zone, uuid);
-- drop type public.admin_user_row;
