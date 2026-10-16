-- E01-S18 fix — never derive the public identity from the email address.
-- 20261016160000_identity_profiles fell back to the email local part for
-- display_name AND username when the account had no name in its metadata (every
-- magic-link account). profiles is anon-readable, so that published part of each
-- user's email address. New defaults, per the design handoff ("Dodała Ania K.",
-- username generated from the first name):
--   display_name: first name + last initial from OAuth metadata, else 'Użytkownik'
--   username:     first name from OAuth metadata, else 'uzytkownik' (+ -2, -3, …)
-- Existing profiles still holding the email-derived default are re-keyed.

create or replace function public.profile_display_name(meta jsonb)
returns text
language sql
immutable
as $$
  with n as (
    select regexp_split_to_array(
      btrim(coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''), '')),
      '\s+'
    ) as parts
  )
  select case
    when coalesce(parts[1], '') = '' then 'Użytkownik'
    when cardinality(parts) = 1 then parts[1]
    else parts[1] || ' ' || upper(left(parts[cardinality(parts)], 1)) || '.'
  end
  from n
$$;

create or replace function public.profile_username_base(meta jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(split_part(btrim(coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''), '')), ' ', 1), ''),
    'uzytkownik'
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    public.profile_display_name(new.raw_user_meta_data),
    public.generate_username(public.profile_username_base(new.raw_user_meta_data))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The email-based helper is no longer used by anything.
drop function if exists public.profile_base_name(text, jsonb);

-- Re-key profiles that still carry the email-derived default. username is
-- immutable by design (stable /u/ links); this one-time correction bypasses that
-- guard inside this migration only. Row by row so each new username sees the
-- ones assigned before it.
alter table public.profiles disable trigger profiles_username_immutable;

do $$
declare
  r record;
begin
  for r in
    select p.id, u.raw_user_meta_data as meta
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.display_name = split_part(coalesce(u.email, ''), '@', 1)
    order by p.created_at, p.id
  loop
    update public.profiles
       set display_name = public.profile_display_name(r.meta),
           username = public.generate_username(public.profile_username_base(r.meta))
     where id = r.id;
  end loop;
end $$;

alter table public.profiles enable trigger profiles_username_immutable;
