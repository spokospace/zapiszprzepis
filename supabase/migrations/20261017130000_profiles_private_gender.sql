-- E01-S12 — Private profile: the one-time gender choice made at first login.
-- Spec: .ai/specs/2026-10-17-oauth-login-gender-vocative.md
--
-- public.profiles (S18) is anon-readable, so private attributes live here:
-- owner-only reads, and NO insert/update/delete policies — the only write path
-- is public.set_gender(), which succeeds only while gender is still null. A
-- trigger additionally refuses to change a non-null gender for every role
-- (incl. service_role), so the choice is final (CLAUDE.md: "Płeć wybierana raz
-- przy pierwszym logowaniu, nieedytowalna").
--
-- Rows are created lazily by set_gender(); a missing row means "not chosen
-- yet". handle_new_user (S18) is unchanged and nothing is backfilled.
--
-- Idempotent: safe to re-run.
--
-- Owner-only correction of a mistaken choice (support request):
--   alter table public.profiles_private disable trigger profiles_private_gender_immutable;
--   update public.profiles_private set gender = '<female|male>', gender_set_at = now() where id = '<uuid>';
--   alter table public.profiles_private enable trigger profiles_private_gender_immutable;
--
-- Rollback (loses only the stored choices):
--   drop function if exists public.set_gender(text);
--   drop table if exists public.profiles_private;
--   drop function if exists public.enforce_gender_immutable();

create table if not exists public.profiles_private (
  id uuid primary key references auth.users(id) on delete cascade,
  gender text check (gender in ('female', 'male')),
  gender_set_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.profiles_private is
  'Private per-user attributes (E01-S12): gender, chosen once at first login. '
  'Owner-only read; written only via set_gender(). Never exposed to anon.';

alter table public.profiles_private enable row level security;

drop policy if exists profiles_private_owner_read on public.profiles_private;
create policy profiles_private_owner_read
  on public.profiles_private
  for select
  to authenticated
  using (id = public.current_user_id());

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. This table is read-only for its owner; writes go through
-- set_gender() (SECURITY DEFINER).
revoke all on public.profiles_private from anon, authenticated;
grant select on public.profiles_private to authenticated;

-- Once set, gender never changes — whoever writes. Also bumps updated_at.
create or replace function public.enforce_gender_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'gender is immutable once chosen';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_private_gender_immutable on public.profiles_private;
create trigger profiles_private_gender_immutable
  before update on public.profiles_private
  for each row
  execute function public.enforce_gender_immutable();

-- The single write path. First write wins: concurrent or repeated calls after
-- the first return 'already_set' and never change the stored value.
-- Returns 'ok' | 'already_set' | 'invalid'; raises when called without a user.
create or replace function public.set_gender(p_gender text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  written int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_gender is null or p_gender not in ('female', 'male') then
    return 'invalid';
  end if;

  insert into public.profiles_private as pp (id, gender, gender_set_at)
  values (uid, p_gender, now())
  on conflict (id) do update
    set gender = excluded.gender,
        gender_set_at = excluded.gender_set_at
    where pp.gender is null;

  get diagnostics written = row_count;
  return case when written = 1 then 'ok' else 'already_set' end;
end;
$$;

revoke all on function public.set_gender(text) from public, anon;
grant execute on function public.set_gender(text) to authenticated;
