-- Admin panel, Phase 1 — access codes and the full-access entitlement.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (API Contracts, Access)
--
-- Today an access code is made by running create_access_code() by hand with a code
-- the owner invents. The panel generates the code in the database, passes it to the
-- existing create_access_code() (so the length rule and the hash-only storage stay
-- in ONE place), and returns it once. The code is never written to the audit log
-- or stored in the clear. Codes list without their hash.
--
-- Staff can also grant or revoke full access for one account directly. That needs
-- one more allowed `source` value on user_full_access ('staff').
--
-- Requires 20261028100000 and 20261028110000. Applied only with the owner's
-- explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

-- ── user_full_access.source gains 'staff' ───────────────────────────────────
alter table public.user_full_access drop constraint if exists user_full_access_source_check;
alter table public.user_full_access
  add constraint user_full_access_source_check
  check (source in ('code', 'grandfathered', 'payment', 'staff'));

-- ── Row type ────────────────────────────────────────────────────────────────
do $$
begin
  create type public.admin_access_code_row as (
    id bigint,
    note text,
    max_uses integer,
    use_count integer,
    expires_at timestamp with time zone,
    created_at timestamp with time zone,
    state text
  );
exception when duplicate_object then null;
end $$;

-- ── Create a code ───────────────────────────────────────────────────────────
-- Returns the code in the form XXXX-XXXX-XXXX-XXXX (16 random characters, far
-- over the 10-character minimum create_access_code enforces). SHOWN ONCE.
create or replace function public.admin_create_access_code_as(
  p_actor uuid,
  p_note text default null,
  p_max_uses integer default 1,
  p_expires_at timestamp with time zone default null,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text;
  new_code text;
  new_id bigint;
begin
  if not public.staff_can(p_actor, 'access.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 1000
     or (p_expires_at is not null and p_expires_at <= now())
     or length(coalesce(p_note, '')) > 200 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  raw := upper(substr(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'), 1, 16));
  new_code := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4) || '-' || substr(raw, 13, 4);

  new_id := public.create_access_code(new_code, p_max_uses, p_expires_at, nullif(btrim(coalesce(p_note, '')), ''));

  -- Id, limits and expiry only. The code itself never reaches the log.
  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'access', 'create_code', new_id::text, null,
    jsonb_build_object('max_uses', p_max_uses, 'expires_at', p_expires_at)
  );

  return new_code;
end;
$$;

-- ── List codes (no hash) ────────────────────────────────────────────────────
create or replace function public.admin_list_access_codes_as(p_actor uuid, p_limit integer default 100)
returns setof public.admin_access_code_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.staff_can(p_actor, 'access.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      c.id,
      c.note,
      c.max_uses,
      c.use_count,
      c.expires_at,
      c.created_at,
      case
        when c.use_count >= c.max_uses then 'used_up'
        when c.expires_at is not null and c.expires_at <= now() then 'expired'
        else 'active'
      end
    from public.access_codes c
    order by c.id desc
    limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

-- ── Grant or revoke full access for one account ─────────────────────────────
create or replace function public.admin_set_full_access_as(
  p_actor uuid,
  p_user uuid,
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
  had boolean;
begin
  if not public.staff_can(p_actor, 'access.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_on is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  had := exists (select 1 from public.user_full_access where user_id = p_user);

  if p_on then
    insert into public.user_full_access (user_id, source) values (p_user, 'staff')
    on conflict (user_id) do nothing;
  else
    delete from public.user_full_access where user_id = p_user;
  end if;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'access', 'set_full_access', p_user::text,
    jsonb_build_object('full_access', had),
    jsonb_build_object('full_access', p_on)
  );
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_create_access_code(
  p_note text default null,
  p_max_uses integer default 1,
  p_expires_at timestamp with time zone default null
)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_create_access_code_as(auth.uid(), p_note, p_max_uses, p_expires_at, 'panel', null)
$$;

create or replace function public.admin_list_access_codes(p_limit integer default 100)
returns setof public.admin_access_code_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_access_codes_as(auth.uid(), p_limit)
$$;

create or replace function public.admin_set_full_access(p_user uuid, p_on boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_set_full_access_as(auth.uid(), p_user, p_on, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_create_access_code_as(uuid, text, integer, timestamp with time zone, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_access_codes_as(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_set_full_access_as(uuid, uuid, boolean, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_create_access_code(text, integer, timestamp with time zone) from public, anon, authenticated;
revoke all on function public.admin_list_access_codes(integer) from public, anon, authenticated;
revoke all on function public.admin_set_full_access(uuid, boolean) from public, anon, authenticated;

grant execute on function public.admin_create_access_code_as(uuid, text, integer, timestamp with time zone, text, bigint) to service_role;
grant execute on function public.admin_list_access_codes_as(uuid, integer) to service_role;
grant execute on function public.admin_set_full_access_as(uuid, uuid, boolean, text, bigint) to service_role;
grant execute on function public.admin_create_access_code(text, integer, timestamp with time zone) to authenticated;
grant execute on function public.admin_list_access_codes(integer) to authenticated;
grant execute on function public.admin_set_full_access(uuid, boolean) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_access_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_create_access_code_as(uuid,text,integer,timestamp with time zone,text,bigint)',
    'public.admin_list_access_codes_as(uuid,integer)',
    'public.admin_set_full_access_as(uuid,uuid,boolean,text,bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin access grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_create_access_code(text,integer,timestamp with time zone)',
    'public.admin_list_access_codes(integer)',
    'public.admin_set_full_access(uuid,boolean)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin access grant check: anon can execute %', f;
    end if;
  end loop;
  -- create_access_code itself stays service-only: the generator wraps it.
  if has_function_privilege('anon', 'public.create_access_code(text,integer,timestamp with time zone,text)', 'execute')
     or has_function_privilege('authenticated', 'public.create_access_code(text,integer,timestamp with time zone,text)', 'execute') then
    raise exception 'admin access grant check: create_access_code is executable by an API role';
  end if;
end;
$$;

revoke all on function public.assert_admin_access_grants() from public, anon, authenticated;

select public.assert_admin_access_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_access_grants(), public.admin_set_full_access(uuid, boolean),
--   public.admin_list_access_codes(integer), public.admin_create_access_code(text, integer, timestamp with time zone),
--   public.admin_set_full_access_as(uuid, uuid, boolean, text, bigint), public.admin_list_access_codes_as(uuid, integer),
--   public.admin_create_access_code_as(uuid, text, integer, timestamp with time zone, text, bigint);
-- drop type public.admin_access_code_row;
-- delete from public.user_full_access where source = 'staff';
-- alter table public.user_full_access drop constraint user_full_access_source_check;
-- alter table public.user_full_access add constraint user_full_access_source_check
--   check (source in ('code', 'grandfathered', 'payment'));
