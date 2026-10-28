-- Admin panel, Phase 1 — roles screen: who holds which role, grant and revoke.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (API Contracts, Roles)
--
-- Rules enforced here, in SQL, so no front end can forget them:
--   * a staff member cannot change their own roles (a second admin does it);
--   * the last admin cannot be removed (checked under an advisory lock, so two
--     admins removing each other at the same moment cannot both succeed);
--   * only roles that exist in staff_roles can be granted.
-- There is no path to the FIRST admin through the API: the owner inserts it with
-- SQL (see the header of 20261028100000_staff_roles_permissions.sql).
--
-- Requires 20261028100000 and 20261028110000. Applied only with the owner's
-- explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

do $$
begin
  create type public.admin_staff_row as (
    user_id uuid,
    username text,
    display_name text,
    roles text[],
    granted_at timestamp with time zone
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.admin_role_row as (
    name text,
    description text,
    permissions text[]
  );
exception when duplicate_object then null;
end $$;

-- ── Read ────────────────────────────────────────────────────────────────────

create or replace function public.admin_list_staff_as(p_actor uuid)
returns setof public.admin_staff_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.staff_can(p_actor, 'roles.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      ur.user_id,
      p.username,
      p.display_name,
      array_agg(ur.role order by ur.role),
      min(ur.granted_at)
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    group by ur.user_id, p.username, p.display_name
    order by min(ur.granted_at), ur.user_id;
end;
$$;

create or replace function public.admin_list_roles_as(p_actor uuid)
returns setof public.admin_role_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.staff_can(p_actor, 'roles.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      r.name,
      r.description,
      coalesce((select array_agg(rp.permission order by rp.permission) from public.staff_role_permissions rp where rp.role = r.name), '{}'::text[])
    from public.staff_roles r
    order by r.name;
end;
$$;

-- ── Write ───────────────────────────────────────────────────────────────────

create or replace function public.admin_set_role_as(
  p_actor uuid,
  p_user uuid,
  p_role text,
  p_on boolean,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_roles text[];
  after_roles text[];
begin
  if not public.staff_can(p_actor, 'roles.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_on is null or p_role is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_actor = p_user then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff_roles where name = p_role) then
    raise exception 'unknown_role' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Serialize role changes: the last-admin count below must not race.
  perform pg_advisory_xact_lock(hashtext('admin_set_role'));

  select coalesce(array_agg(role order by role), '{}'::text[]) into before_roles
  from public.user_roles where user_id = p_user;

  if p_on then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, p_actor)
    on conflict (user_id, role) do nothing;
  else
    if p_role = 'admin'
       and not exists (select 1 from public.user_roles where role = 'admin' and user_id <> p_user) then
      raise exception 'last_admin' using errcode = '42501';
    end if;
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;

  select coalesce(array_agg(role order by role), '{}'::text[]) into after_roles
  from public.user_roles where user_id = p_user;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'roles', 'set_role', p_user::text,
    jsonb_build_object('roles', to_jsonb(before_roles)),
    jsonb_build_object('roles', to_jsonb(after_roles))
  );
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_list_staff()
returns setof public.admin_staff_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_staff_as(auth.uid())
$$;

create or replace function public.admin_list_roles()
returns setof public.admin_role_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_roles_as(auth.uid())
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text, p_on boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_set_role_as(auth.uid(), p_user, p_role, p_on, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_list_staff_as(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_roles_as(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_role_as(uuid, uuid, text, boolean, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_staff() from public, anon, authenticated;
revoke all on function public.admin_list_roles() from public, anon, authenticated;
revoke all on function public.admin_set_role(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.admin_list_staff_as(uuid) to service_role;
grant execute on function public.admin_list_roles_as(uuid) to service_role;
grant execute on function public.admin_set_role_as(uuid, uuid, text, boolean, text, bigint) to service_role;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_list_roles() to authenticated;
grant execute on function public.admin_set_role(uuid, text, boolean) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_roles_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_list_staff_as(uuid)',
    'public.admin_list_roles_as(uuid)',
    'public.admin_set_role_as(uuid,uuid,text,boolean,text,bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin roles grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_list_staff()',
    'public.admin_list_roles()',
    'public.admin_set_role(uuid,text,boolean)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin roles grant check: anon can execute %', f;
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_admin_roles_grants() from public, anon, authenticated;

select public.assert_admin_roles_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_roles_grants(), public.admin_set_role(uuid, text, boolean),
--   public.admin_list_roles(), public.admin_list_staff(),
--   public.admin_set_role_as(uuid, uuid, text, boolean, text, bigint),
--   public.admin_list_roles_as(uuid), public.admin_list_staff_as(uuid);
-- drop type public.admin_role_row, public.admin_staff_row;
