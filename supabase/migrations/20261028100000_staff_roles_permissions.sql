-- Admin panel, Phase 1 — staff roles and permissions.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (Data Model, Phase 1)
--
-- Roles live in PRIVATE tables, never on `profiles` (that table is readable by
-- anon and updatable by its owner, so a role column there would let anyone grant
-- themselves a role). Roles and their permissions are DATA: a new role is an
-- insert into staff_roles / staff_role_permissions, not a migration.
--
-- Bootstrap (owner-run, once, in the SQL editor — there is deliberately no UI
-- path to the first admin):
--   insert into public.user_roles (user_id, role, granted_by)
--   values ('<owner auth.users id>', 'admin', '<same id>');
--
-- Deploy order (owner-gated): apply this migration, bootstrap the first admin,
-- then deploy the app. Nothing here changes what a non-staff user can do.
-- Local development points at the production database, so this file is applied
-- only with the owner's explicit go.
--
-- Idempotent: safe to re-run.

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.staff_roles (
  name text primary key check (name ~ '^[a-z][a-z0-9_]{1,31}$'),
  description text
);

comment on table public.staff_roles is
  'Admin panel roles. Service-only: no API-role grants. A new role is an insert.';

create table if not exists public.staff_role_permissions (
  role text not null references public.staff_roles(name) on update cascade on delete cascade,
  permission text not null check (permission ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$'),
  primary key (role, permission)
);

comment on table public.staff_role_permissions is
  'Dotted permissions per role (e.g. users.read). Service-only.';

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null references public.staff_roles(name) on update cascade on delete restrict,
  granted_by uuid,
  granted_at timestamp with time zone not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Who holds which staff role. The owner may read their own rows; nobody writes '
  'through the API (admin_set_role / the SQL editor / service role do).';

create index if not exists idx_user_roles_role on public.user_roles(role);

-- ── RLS + grants ────────────────────────────────────────────────────────────

alter table public.staff_roles enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated; take them back.
revoke all on public.staff_roles from anon, authenticated;
revoke all on public.staff_role_permissions from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;

-- The owner may only READ their own role rows (no insert/update/delete grant, so
-- nobody can grant themselves a role through the API).
grant select on public.user_roles to authenticated;

drop policy if exists user_roles_owner_select on public.user_roles;
create policy user_roles_owner_select
  on public.user_roles
  for select
  to authenticated
  using (user_id = public.current_user_id());

-- ── Seeds ───────────────────────────────────────────────────────────────────

insert into public.staff_roles (name, description) values
  ('admin', 'Everything, including roles, access codes, account deletion and the audit log.'),
  ('moderator', 'Recipes and the import queue; read-only on users (no e-mail addresses).')
on conflict (name) do nothing;

-- admin: every permission the panel knows (Phases 1-4).
insert into public.staff_role_permissions (role, permission)
select 'admin', p
from unnest(array[
  'users.read', 'users.read_email', 'users.block', 'users.delete',
  'imports.read', 'imports.retry',
  'access.manage', 'roles.manage', 'audit.read',
  'recipes.read', 'recipes.hide', 'recipes.delete', 'recipes.merge',
  'recipes.taxonomy', 'recipes.edit',
  'tokens.own'
]) as p
on conflict do nothing;

-- moderator: recipes and imports, read-only on users, own MCP tokens.
insert into public.staff_role_permissions (role, permission)
select 'moderator', p
from unnest(array[
  'users.read',
  'imports.read', 'imports.retry',
  'recipes.read', 'recipes.hide', 'recipes.delete', 'recipes.merge',
  'recipes.taxonomy', 'recipes.edit',
  'tokens.own'
]) as p
on conflict do nothing;

-- ── Functions ───────────────────────────────────────────────────────────────

-- Does `p_actor` hold `p_permission` through any of their roles? Internal: the
-- `_as` functions and the MCP route call it with an explicit actor, so it is
-- service_role only. Anon and authenticated cannot probe other users' roles.
create or replace function public.staff_can(p_actor uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor is not null and exists (
    select 1
    from public.user_roles ur
    join public.staff_role_permissions rp on rp.role = ur.role
    where ur.user_id = p_actor
      and rp.permission = p_permission
  )
$$;

-- The caller's own check, for the app (what to render) and for RLS. Anon gets
-- false (auth.uid() is null).
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.staff_can(auth.uid(), p_permission)
$$;

-- Every permission the caller holds, in one round trip, for the /admin shell.
create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct rp.permission order by rp.permission), '{}'::text[])
  from public.user_roles ur
  join public.staff_role_permissions rp on rp.role = ur.role
  where ur.user_id = auth.uid()
$$;

revoke all on function public.staff_can(uuid, text) from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
revoke all on function public.my_permissions() from public, anon, authenticated;
grant execute on function public.staff_can(uuid, text) to service_role;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.my_permissions() to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
-- Fail the migration (and so a deploy) when a grant is wrong. Cheaper than a
-- privilege escalation found in review. Run again by hand any time:
--   select public.assert_staff_grants();
create or replace function public.assert_staff_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  t text;
begin
  foreach t in array array['staff_roles', 'staff_role_permissions', 'user_roles'] loop
    if has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete')
       or has_table_privilege('authenticated', 'public.' || t, 'insert,update,delete') then
      raise exception 'staff grant check: % is writable through the API', t;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.user_roles', 'select') then
    raise exception 'staff grant check: anon can read user_roles';
  end if;
  if has_function_privilege('anon', 'public.staff_can(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.staff_can(uuid,text)', 'execute') then
    raise exception 'staff grant check: staff_can is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.has_permission(text)', 'execute') then
    raise exception 'staff grant check: anon can execute has_permission';
  end if;
end;
$$;

revoke all on function public.assert_staff_grants() from public, anon, authenticated;

select public.assert_staff_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_staff_grants(), public.my_permissions(),
--   public.has_permission(text), public.staff_can(uuid, text);
-- drop table public.user_roles, public.staff_role_permissions, public.staff_roles;
