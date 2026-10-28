-- Admin panel, Phase 1 — staff audit log.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (Data Model, Phase 1)
--
-- Every staff operation writes one row here, in the SAME transaction as the
-- change (the `_as` functions call staff_audit()). If the audit insert fails the
-- whole operation rolls back: there is no unaudited change.
--
-- No foreign key on actor_id or target_id: deleting an account must never delete
-- its history. For user operations `before` / `after` hold ids and flags only,
-- never an e-mail address or a name (staff_audit() refuses those keys).
--
-- Requires 20261028100000_staff_roles_permissions.sql. Applied only with the
-- owner's explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

create table if not exists public.staff_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  via text not null check (via in ('panel', 'mcp')),
  token_id bigint,
  resource text not null,
  operation text not null,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone not null default now()
);

comment on table public.staff_audit_log is
  'Admin panel audit trail. Service-only; read through admin_list_audit[_as] '
  '(permission audit.read). No foreign keys on purpose.';

create index if not exists idx_staff_audit_log_created on public.staff_audit_log(created_at desc, id desc);
create index if not exists idx_staff_audit_log_actor on public.staff_audit_log(actor_id, id desc);
create index if not exists idx_staff_audit_log_resource on public.staff_audit_log(resource, id desc);

alter table public.staff_audit_log enable row level security;
revoke all on public.staff_audit_log from anon, authenticated;

-- ── Writer ──────────────────────────────────────────────────────────────────
-- Internal: called by the other admin_* functions (which run as the function
-- owner), never by an API role.
create or replace function public.staff_audit(
  p_actor uuid,
  p_via text,
  p_token_id bigint,
  p_resource text,
  p_operation text,
  p_target_id text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  -- Personal data does not belong in the log. A top-level key is enough to
  -- catch a careless caller; the app-side payload builder is the main guard.
  if (p_before is not null and jsonb_typeof(p_before) = 'object' and p_before ?| array['email', 'phone', 'name', 'display_name', 'token', 'code'])
     or (p_after is not null and jsonb_typeof(p_after) = 'object' and p_after ?| array['email', 'phone', 'name', 'display_name', 'token', 'code']) then
    raise exception 'staff_audit: personal data or a secret in the payload';
  end if;

  insert into public.staff_audit_log (actor_id, via, token_id, resource, operation, target_id, before, after)
  values (p_actor, p_via, p_token_id, p_resource, p_operation, p_target_id, p_before, p_after)
  returning id into new_id;
  return new_id;
end;
$$;

-- ── Reader ──────────────────────────────────────────────────────────────────
-- Newest first, keyset paging by id (p_before_id = the smallest id already shown).
create or replace function public.admin_list_audit_as(
  p_actor uuid,
  p_resource text default null,
  p_filter_actor uuid default null,
  p_from timestamp with time zone default null,
  p_to timestamp with time zone default null,
  p_limit integer default 50,
  p_before_id bigint default null
)
returns setof public.staff_audit_log
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.staff_can(p_actor, 'audit.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select *
    from public.staff_audit_log l
    where (p_resource is null or l.resource = p_resource)
      and (p_filter_actor is null or l.actor_id = p_filter_actor)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at < p_to)
      and (p_before_id is null or l.id < p_before_id)
    order by l.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

create or replace function public.admin_list_audit(
  p_resource text default null,
  p_filter_actor uuid default null,
  p_from timestamp with time zone default null,
  p_to timestamp with time zone default null,
  p_limit integer default 50,
  p_before_id bigint default null
)
returns setof public.staff_audit_log
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_audit_as(auth.uid(), p_resource, p_filter_actor, p_from, p_to, p_limit, p_before_id)
$$;

revoke all on function public.staff_audit(uuid, text, bigint, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.admin_list_audit_as(uuid, text, uuid, timestamp with time zone, timestamp with time zone, integer, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_audit(text, uuid, timestamp with time zone, timestamp with time zone, integer, bigint) from public, anon, authenticated;
grant execute on function public.staff_audit(uuid, text, bigint, text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.admin_list_audit_as(uuid, text, uuid, timestamp with time zone, timestamp with time zone, integer, bigint) to service_role;
grant execute on function public.admin_list_audit(text, uuid, timestamp with time zone, timestamp with time zone, integer, bigint) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_staff_audit_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if has_table_privilege('anon', 'public.staff_audit_log', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.staff_audit_log', 'select,insert,update,delete') then
    raise exception 'staff audit grant check: staff_audit_log is reachable through the API';
  end if;
  if has_function_privilege('anon', 'public.staff_audit(uuid,text,bigint,text,text,text,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.staff_audit(uuid,text,bigint,text,text,text,jsonb,jsonb)', 'execute') then
    raise exception 'staff audit grant check: staff_audit is executable by an API role';
  end if;
  if has_function_privilege('anon', 'public.admin_list_audit(text,uuid,timestamp with time zone,timestamp with time zone,integer,bigint)', 'execute') then
    raise exception 'staff audit grant check: anon can read the audit log';
  end if;
end;
$$;

revoke all on function public.assert_staff_audit_grants() from public, anon, authenticated;

select public.assert_staff_audit_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_staff_audit_grants(), public.admin_list_audit(text, uuid, timestamp with time zone, timestamp with time zone, integer, bigint),
--   public.admin_list_audit_as(uuid, text, uuid, timestamp with time zone, timestamp with time zone, integer, bigint),
--   public.staff_audit(uuid, text, bigint, text, text, text, jsonb, jsonb);
-- drop table public.staff_audit_log;
