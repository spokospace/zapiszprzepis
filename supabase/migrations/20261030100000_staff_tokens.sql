-- Admin panel, Phase 4 — personal tokens for the MCP endpoint (/api/mcp).
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (Data Model "Phase 4", Q4)
--
-- A token is a bearer secret a staff member creates for their own account. It
-- carries NO role: staff_resolve_token() reads the owner's roles and ban state at
-- every call, so blocking the account or taking its roles away disables all of its
-- tokens at once, and so does deleting the account (on delete cascade).
--
--   raw token   zpm_ + 64 hex characters, generated here, returned ONCE by
--               admin_create_token and never stored (the access_codes pattern)
--   stored      its SHA-256 as hex, a short prefix to recognise it in the list,
--               a label, an expiry (default 90 days) and last-use / revoke stamps
--
-- Who can do what:
--   * admin_create_token / admin_list_tokens / admin_revoke_token: the panel's own
--     session, permission `tokens.own` (admin and moderator both hold it), and only
--     ever the caller's own tokens. A token cannot mint another token: the `_as`
--     functions refuse any p_via other than 'panel'.
--   * staff_resolve_token(hash): service_role only, called by the MCP route to turn
--     a bearer token into an actor and the permissions that actor holds right now.
--
-- Requires 20261028100000 and 20261028110000. Applied only with the owner's explicit
-- go (local development points at the production database).
--
-- Idempotent: safe to re-run.

-- ── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.staff_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  prefix text not null,
  label text not null check (char_length(label) between 1 and 80),
  expires_at timestamp with time zone not null,
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists staff_tokens_user_id_idx on public.staff_tokens (user_id);

alter table public.staff_tokens enable row level security;
-- No policy and no grant: the table is reachable only through the functions below.
revoke all on public.staff_tokens from anon, authenticated;

do $$
begin
  create type public.admin_token_row as (
    id bigint,
    label text,
    prefix text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    state text
  );
exception when duplicate_object then null;
end $$;

-- ── Create / list / revoke (internal) ───────────────────────────────────────

-- Returns the raw token. This is the only place it exists in clear text.
create or replace function public.admin_create_token_as(
  p_actor uuid,
  p_label text,
  p_days integer default 90,
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
  clean_label text := btrim(coalesce(p_label, ''));
  new_id bigint;
  expires timestamp with time zone;
begin
  if not public.staff_can(p_actor, 'tokens.own') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- A token cannot create tokens: only the panel session mints them.
  if p_via is distinct from 'panel' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(clean_label) not between 1 and 80 or p_days is null or p_days not between 1 and 365 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  -- Serialize per account so two clicks cannot slip past the cap.
  perform pg_advisory_xact_lock(hashtext('staff_token:' || p_actor::text));
  if (
    select count(*) from public.staff_tokens
    where user_id = p_actor and revoked_at is null and expires_at > now()
  ) >= 10 then
    raise exception 'too_many_tokens' using errcode = '22023';
  end if;

  -- Two random UUIDs: 244 random bits, hex only.
  raw := 'zpm_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  expires := now() + make_interval(days => p_days);

  insert into public.staff_tokens (user_id, token_hash, prefix, label, expires_at)
  values (p_actor, encode(sha256(convert_to(raw, 'UTF8')), 'hex'), substr(raw, 1, 8), clean_label, expires)
  returning id into new_id;

  -- The audit row names the token and its expiry, never the secret.
  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'tokens', 'create', new_id::text, null,
    jsonb_build_object('expires_at', expires, 'days', p_days)
  );

  return raw;
end;
$$;

create or replace function public.admin_list_tokens_as(p_actor uuid)
returns setof public.admin_token_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.staff_can(p_actor, 'tokens.own') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      t.id, t.label, t.prefix, t.created_at, t.expires_at, t.last_used_at, t.revoked_at,
      case
        when t.revoked_at is not null then 'revoked'
        when t.expires_at <= now() then 'expired'
        else 'active'
      end
    from public.staff_tokens t
    where t.user_id = p_actor
    order by t.created_at desc, t.id desc
    limit 100;
end;
$$;

-- Own tokens only; revoking twice is not an error.
create or replace function public.admin_revoke_token_as(
  p_actor uuid,
  p_id bigint,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.staff_can(p_actor, 'tokens.own') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_via is distinct from 'panel' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff_tokens where id = p_id and user_id = p_actor) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.staff_tokens set revoked_at = now()
  where id = p_id and user_id = p_actor and revoked_at is null;
  get diagnostics changed = row_count;

  if changed > 0 then
    perform public.staff_audit(p_actor, p_via, p_token_id, 'tokens', 'revoke', p_id::text, null, null);
  end if;
end;
$$;

-- ── Resolve (internal, MCP route only) ──────────────────────────────────────

-- Bearer token hash -> the actor and the permissions that actor holds right now.
-- No row when the token is unknown, revoked or expired, when the account is banned,
-- or when the account holds no role. Nothing is cached anywhere: a block or a role
-- removal takes effect on the very next call.
create or replace function public.staff_resolve_token(p_hash text)
returns table (token_id bigint, actor_id uuid, permissions text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  found_id bigint;
  found_user uuid;
  perms text[];
begin
  select t.id, t.user_id into found_id, found_user
  from public.staff_tokens t
  join auth.users u on u.id = t.user_id
  where t.token_hash = p_hash
    and t.revoked_at is null
    and t.expires_at > now()
    and (u.banned_until is null or u.banned_until <= now());
  if found_id is null then
    return;
  end if;

  select coalesce(array_agg(distinct rp.permission order by rp.permission), '{}'::text[]) into perms
  from public.user_roles ur
  join public.staff_role_permissions rp on rp.role = ur.role
  where ur.user_id = found_user;
  if cardinality(perms) = 0 then
    return;
  end if;

  -- Last-used, at most once a minute per token (keeps a busy session from
  -- rewriting the row on every call).
  update public.staff_tokens set last_used_at = now()
  where id = found_id and (last_used_at is null or last_used_at < now() - interval '1 minute');

  return query select found_id, found_user, perms;
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_create_token(p_label text, p_days integer default 90)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.admin_create_token_as(auth.uid(), p_label, p_days, 'panel', null)
$$;

create or replace function public.admin_list_tokens()
returns setof public.admin_token_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_tokens_as(auth.uid())
$$;

create or replace function public.admin_revoke_token(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_revoke_token_as(auth.uid(), p_id, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_create_token_as(uuid, text, integer, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_tokens_as(uuid) from public, anon, authenticated;
revoke all on function public.admin_revoke_token_as(uuid, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.staff_resolve_token(text) from public, anon, authenticated;
revoke all on function public.admin_create_token(text, integer) from public, anon, authenticated;
revoke all on function public.admin_list_tokens() from public, anon, authenticated;
revoke all on function public.admin_revoke_token(bigint) from public, anon, authenticated;

grant execute on function public.admin_create_token_as(uuid, text, integer, text, bigint) to service_role;
grant execute on function public.admin_list_tokens_as(uuid) to service_role;
grant execute on function public.admin_revoke_token_as(uuid, bigint, text, bigint) to service_role;
grant execute on function public.staff_resolve_token(text) to service_role;
grant execute on function public.admin_create_token(text, integer) to authenticated;
grant execute on function public.admin_list_tokens() to authenticated;
grant execute on function public.admin_revoke_token(bigint) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_staff_tokens_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  if has_table_privilege('anon', 'public.staff_tokens', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.staff_tokens', 'select,insert,update,delete') then
    raise exception 'staff tokens grant check: staff_tokens is reachable through the API';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.staff_tokens'::regclass) then
    raise exception 'staff tokens grant check: row level security is off on staff_tokens';
  end if;
  foreach f in array array[
    'public.admin_create_token_as(uuid,text,integer,text,bigint)',
    'public.admin_list_tokens_as(uuid)',
    'public.admin_revoke_token_as(uuid,bigint,text,bigint)',
    'public.staff_resolve_token(text)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'staff tokens grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_create_token(text,integer)',
    'public.admin_list_tokens()',
    'public.admin_revoke_token(bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'staff tokens grant check: anon can execute %', f;
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_staff_tokens_grants() from public, anon, authenticated;

select public.assert_staff_tokens_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_staff_tokens_grants(), public.admin_revoke_token(bigint),
--   public.admin_list_tokens(), public.admin_create_token(text, integer),
--   public.staff_resolve_token(text), public.admin_revoke_token_as(uuid, bigint, text, bigint),
--   public.admin_list_tokens_as(uuid), public.admin_create_token_as(uuid, text, integer, text, bigint);
-- drop type public.admin_token_row;
-- drop table public.staff_tokens;
