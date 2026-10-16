-- E01-S18 — Identity profile: public display name + username.
-- The guest-visible identity behind the "Dodała {display_name}" line and
-- /u/{username}. display_name is editable; username is generated once and
-- immutable. PRIVATE attributes (gender, vocative, …) do NOT belong here —
-- this table is anon-readable, so it holds only public identity (S12 owns the
-- private profile surface).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null unique,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.profiles is
  'Public identity per user: display_name (shown as "Dodała X") and username '
  '(for /u/{username}). Anon-readable; private attributes live elsewhere (S12).';

alter table public.profiles enable row level security;

-- Anyone (incl. anon) may read the public identity — it is shown on recipe
-- cards, the recipe page and the public profile.
create policy profiles_public_read
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- The owner may update only their own row.
create policy profiles_owner_update
  on public.profiles
  for update
  to authenticated
  using (id = public.current_user_id())
  with check (id = public.current_user_id());

-- username is assigned once at creation and never changes (stable /u/ links).
create or replace function public.enforce_username_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'username is immutable';
  end if;
  return new;
end;
$$;

create trigger profiles_username_immutable
  before update on public.profiles
  for each row
  execute function public.enforce_username_immutable();

-- updated_at bump (same convention as recipes/recipe_shares).
create or replace function public.update_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at_trigger
  before update on public.profiles
  for each row
  execute function public.update_profiles_updated_at();

-- Generate a unique username from a base string. Mirrors src/lib/slugify.ts
-- (ł→l, ą→a, …; lowercase; non-alnum → '-'); appends -2, -3, … on collision.
-- Keep the Polish→ASCII map in sync with slugify.ts if either changes.
create or replace function public.generate_username(base text)
returns text
language plpgsql
as $$
declare
  root text;
  candidate text;
  n int := 1;
begin
  root := translate(lower(coalesce(base, '')), 'ąćęłńóśźż', 'acelnoszz');
  root := regexp_replace(root, '[^a-z0-9]+', '-', 'g');
  root := trim(both '-' from root);
  if root = '' then
    root := 'uzytkownik';
  end if;
  root := left(root, 40);
  candidate := root;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- Public display name derived from OAuth metadata (full_name/name, available
-- once S12 lands) or the email local part. One source of truth for the trigger
-- and the backfill so the rule cannot drift between them.
create or replace function public.profile_base_name(email text, meta jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Użytkownik'
  )
$$;

-- Create a profile automatically for every new user. SECURITY DEFINER so the
-- trigger writes past RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
begin
  base := public.profile_base_name(new.email, new.raw_user_meta_data);
  insert into public.profiles (id, display_name, username)
  values (new.id, base, public.generate_username(base))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill the existing accounts (the few test users) that have no profile yet.
-- Row-by-row so each generated username sees the ones inserted before it.
do $$
declare
  r record;
  base text;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    base := public.profile_base_name(r.email, r.raw_user_meta_data);
    insert into public.profiles (id, display_name, username)
    values (r.id, base, public.generate_username(base));
  end loop;
end $$;
