-- E01-S11 — Add gate: full access via an access code (screen 3c).
-- Spec: .ai/specs/2026-10-17-access-code-add-gate.md
--
-- Only users with FULL ACCESS may add recipes. Access is a private per-user
-- entitlement (user_full_access), granted by redeeming an access code through
-- redeem_access_code() (or, later, by a payment). RLS on INSERT into
-- recipe_shares and recipes now also requires has_full_access(), so the gate
-- holds even for a hand-crafted PostgREST call. Inngest writes with the service
-- role and is unaffected.
--
-- Deploy order (owner-gated): apply THIS migration first, then deploy the app.
-- The new app fails closed without has_full_access() and would lock everyone out.
--
-- Idempotent: safe to re-run (if not exists / create or replace / drop policy
-- if exists / on conflict do nothing).

-- ── Tables ──────────────────────────────────────────────────────────────────

-- Codes are stored only as a SHA-256 of the normalized code (access_code_hash).
create table if not exists public.access_codes (
  id bigint generated always as identity primary key,
  code_hash text not null unique,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  expires_at timestamp with time zone,
  note text,
  created_at timestamp with time zone not null default now()
);

comment on table public.access_codes is
  'E01-S11 access codes (hash only). Service-only: no API-role grants. '
  'Create codes with public.create_access_code().';

-- Failed redemption attempts, for the per-user rate limit.
create table if not exists public.access_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamp with time zone not null default now()
);

create index if not exists idx_access_code_attempts_user_time
  on public.access_code_attempts(user_id, attempted_at);

-- The entitlement itself. Private (NOT on the anon-readable profiles table).
-- code_id is the "used by" record: a user redeems at most once (a user who
-- already has access gets 'already'), so no separate redemptions table.
create table if not exists public.user_full_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('code', 'grandfathered', 'payment')),
  code_id bigint references public.access_codes(id) on delete set null,
  granted_at timestamp with time zone not null default now()
);

comment on table public.user_full_access is
  'E01-S11 full access (may add recipes). Owner can read own row; only '
  'redeem_access_code() / service role write it.';

-- ── RLS + grants ────────────────────────────────────────────────────────────

alter table public.access_codes enable row level security;
alter table public.access_code_attempts enable row level security;
alter table public.user_full_access enable row level security;

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated; take them back. Codes and attempts are service-only.
revoke all on public.access_codes from anon, authenticated;
revoke all on public.access_code_attempts from anon, authenticated;
revoke all on public.user_full_access from anon, authenticated;

-- The owner may only READ their own entitlement; no insert/update/delete grant,
-- so nobody can grant themselves access through the API.
grant select on public.user_full_access to authenticated;

drop policy if exists user_full_access_owner_select on public.user_full_access;
create policy user_full_access_owner_select
  on public.user_full_access
  for select
  to authenticated
  using (user_id = public.current_user_id());

-- ── Functions ───────────────────────────────────────────────────────────────

-- Normalized form of a code: case, whitespace and hyphens do not matter, so
-- "ABCD 1234" and "abcd-1234" are the same code.
create or replace function public.access_code_normalize(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'))
$$;

-- Normalized code → hex SHA-256. sha256() is built in (pg_catalog), so no
-- extension is needed.
create or replace function public.access_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(public.access_code_normalize(p_code), 'UTF8')), 'hex')
$$;

-- Does the current user have full access? Used by RLS and by the app
-- (src/lib/full-access.ts). Anon always gets false (auth.uid() is null).
create or replace function public.has_full_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_full_access where user_id = auth.uid())
$$;

-- Redeem a code for the current user. Returns one of:
--   'ok'           — access granted now
--   'already'      — the user already had full access (no use consumed)
--   'invalid'      — unknown, expired or used up (one token for all: no
--                    enumeration oracle)
--   'rate_limited' — 5 failed attempts in the last 15 minutes; code not checked
-- Never raises for these cases: a raise would roll back the recorded attempt
-- and defeat the rate limit.
create or replace function public.redeem_access_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code public.access_codes%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Serialize this user's concurrent calls (double submit, two tabs with two
  -- codes): the second waits here, then sees the grant and spends nothing.
  perform pg_advisory_xact_lock(hashtext('redeem_access_code:' || uid::text));

  if exists (select 1 from public.user_full_access where user_id = uid) then
    return 'already';
  end if;

  if (
    select count(*) from public.access_code_attempts
    where user_id = uid and attempted_at > now() - interval '15 minutes'
  ) >= 5 then
    return 'rate_limited';
  end if;

  -- Row lock: two users racing for the last use are serialized here.
  select * into code
  from public.access_codes
  where length(coalesce(p_code, '')) <= 200
    and code_hash = public.access_code_hash(p_code)
  for update;

  if not found
     or (code.expires_at is not null and code.expires_at <= now())
     or code.use_count >= code.max_uses then
    insert into public.access_code_attempts (user_id) values (uid);
    -- Keep the table small: a day-old failure no longer counts for anything.
    delete from public.access_code_attempts
    where user_id = uid and attempted_at < now() - interval '1 day';
    return 'invalid';
  end if;

  -- user_full_access.code_id is the "used by" record.
  insert into public.user_full_access (user_id, source, code_id)
  values (uid, 'code', code.id);
  update public.access_codes set use_count = use_count + 1 where id = code.id;
  delete from public.access_code_attempts where user_id = uid;
  return 'ok';
end;
$$;

-- Owner tooling: create a code (SQL editor / Management API / service role).
-- Returns the new code id. Codes need ≥ 10 normalized characters (new accounts
-- are free since S12, so code length — not the per-user rate limit — is what
-- stops guessing). Generate them at random, e.g.
--   select upper(substr(md5(gen_random_uuid()::text), 1, 12));
create or replace function public.create_access_code(
  p_code text,
  p_max_uses integer default 1,
  p_expires_at timestamp with time zone default null,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if length(public.access_code_normalize(p_code)) < 10 then
    raise exception 'access code must have at least 10 characters';
  end if;
  insert into public.access_codes (code_hash, max_uses, expires_at, note)
  values (public.access_code_hash(p_code), p_max_uses, p_expires_at, p_note)
  returning id into new_id;
  return new_id;
end;
$$;

-- Function grants: Supabase grants EXECUTE on new functions to the API roles by
-- default; revoke everything, then grant only what the app calls.
revoke all on function public.access_code_normalize(text) from public, anon, authenticated;
revoke all on function public.access_code_hash(text) from public, anon, authenticated;
revoke all on function public.has_full_access() from public, anon, authenticated;
revoke all on function public.redeem_access_code(text) from public, anon, authenticated;
revoke all on function public.create_access_code(text, integer, timestamp with time zone, text)
  from public, anon, authenticated;
grant execute on function public.has_full_access() to anon, authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;

-- ── RLS: gate INSERT on recipe_shares and recipes ──────────────────────────
-- Split the old FOR ALL owner policies per command. SELECT/UPDATE/DELETE stay
-- owner-only exactly as before (retry, edits, deletes of existing rows keep
-- working); INSERT additionally needs full access.

drop policy if exists recipe_shares_user_isolation on public.recipe_shares;
drop policy if exists recipe_shares_owner_select on public.recipe_shares;
drop policy if exists recipe_shares_owner_insert on public.recipe_shares;
drop policy if exists recipe_shares_owner_update on public.recipe_shares;
drop policy if exists recipe_shares_owner_delete on public.recipe_shares;

create policy recipe_shares_owner_select
  on public.recipe_shares
  for select
  using (user_id = public.current_user_id());

create policy recipe_shares_owner_insert
  on public.recipe_shares
  for insert
  with check (user_id = public.current_user_id() and (select public.has_full_access()));

create policy recipe_shares_owner_update
  on public.recipe_shares
  for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy recipe_shares_owner_delete
  on public.recipe_shares
  for delete
  using (user_id = public.current_user_id());

drop policy if exists recipes_user_isolation on public.recipes;
drop policy if exists recipes_owner_select on public.recipes;
drop policy if exists recipes_owner_insert on public.recipes;
drop policy if exists recipes_owner_update on public.recipes;
drop policy if exists recipes_owner_delete on public.recipes;

create policy recipes_owner_select
  on public.recipes
  for select
  using (user_id = public.current_user_id());

create policy recipes_owner_insert
  on public.recipes
  for insert
  with check (user_id = public.current_user_id() and (select public.has_full_access()));

create policy recipes_owner_update
  on public.recipes
  for update
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy recipes_owner_delete
  on public.recipes
  for delete
  using (user_id = public.current_user_id());

-- ── Backfill: grandfather today's adders ────────────────────────────────────
-- 1) Every email-identity account: before S12 the only way to create one was
--    the S-07 signup, which demands INVITE_CODE — all of them are invited adders,
--    even those who have not added anything yet.
-- 2) Anyone who already owns a recipe or a share.
-- A social-login (S12) account with no recipes needs a code; S12 keeps its OAuth
-- buttons off until this gate is live.
insert into public.user_full_access (user_id, source)
select u.id, 'grandfathered'
from auth.users u
where exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
   or exists (select 1 from public.recipes r where r.user_id = u.id)
   or exists (select 1 from public.recipe_shares s where s.user_id = u.id)
on conflict (user_id) do nothing;

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop policy recipe_shares_owner_select, recipe_shares_owner_insert,
--   recipe_shares_owner_update, recipe_shares_owner_delete on public.recipe_shares;
-- create policy recipe_shares_user_isolation on public.recipe_shares for all
--   using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
-- (same for recipes → recipes_user_isolation)
-- drop function public.create_access_code(text, integer, timestamp with time zone, text),
--   public.redeem_access_code(text), public.has_full_access(), public.access_code_hash(text),
--   public.access_code_normalize(text);
-- drop table public.user_full_access, public.access_code_attempts, public.access_codes;
