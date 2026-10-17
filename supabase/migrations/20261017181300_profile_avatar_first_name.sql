-- E01-S13 — Settings (screen 2a): profile picture + private first name.
-- Spec: .ai/specs/2026-10-17-e01-s13-settings.md
--
-- 1. public.profiles (anon-readable, S18) gains the PUBLIC picture:
--    avatar_path  — object in the public `avatars` bucket, always inside the
--                   owner's own folder: '{user_id}/{epoch_ms}.jpg'
--    avatar_color — index 0..5 into the app palette (src/lib/avatar.ts);
--                   null = derived from the user id, so no backfill is needed.
-- 2. public.profiles_private (owner-read only, S12) gains the PRIVATE
--    first_name used for the vocative greeting. Like gender it has no write
--    policy: the only write path is public.set_first_name() (SECURITY DEFINER).
--    The S12 gender trigger only rejects a gender change, so it is unaffected;
--    a row created here keeps gender = null ("not chosen yet" for /witaj).
-- 3. The public `avatars` bucket, JPEG only (the browser re-encodes every
--    photo to a 512² JPEG). Anyone fetches an object by its public URL (a
--    public bucket bypasses RLS for that); a signed-in user lists, writes and
--    deletes only under '{auth.uid()}/'. There is deliberately NO public SELECT
--    policy: it would let anyone list the whole bucket, i.e. every user's
--    folder, including replaced photos a failed best-effort delete left behind.
--
-- Idempotent: safe to re-run.
--
-- Rollback (loses uploaded pictures and stored first names):
--   drop policy if exists avatars_owner_read on storage.objects;
--   drop policy if exists avatars_owner_insert on storage.objects;
--   drop policy if exists avatars_owner_update on storage.objects;
--   drop policy if exists avatars_owner_delete on storage.objects;
--   -- empty the bucket through the Storage API, then:
--   delete from storage.buckets where id = 'avatars';
--   drop function if exists public.set_first_name(text);
--   alter table public.profiles_private drop column if exists first_name;
--   alter table public.profiles drop column if exists avatar_path, drop column if exists avatar_color;

-- 1. Public picture ---------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists avatar_color smallint;

alter table public.profiles drop constraint if exists profiles_avatar_color_range;
alter table public.profiles
  add constraint profiles_avatar_color_range
  check (avatar_color is null or avatar_color between 0 and 5);

-- The path must point into the owner's own folder, so nobody can show someone
-- else's upload as their picture.
alter table public.profiles drop constraint if exists profiles_avatar_path_own_folder;
alter table public.profiles
  add constraint profiles_avatar_path_own_folder
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9]{1,16}\.jpg$'));

comment on column public.profiles.avatar_path is
  'Public profile picture: object path in the avatars bucket ({id}/{epoch_ms}.jpg); null = letter avatar (E01-S13).';
comment on column public.profiles.avatar_color is
  'Letter-avatar background, index 0..5 into the app palette; null = derived from id (E01-S13).';

-- 2. Private first name -----------------------------------------------------

alter table public.profiles_private
  add column if not exists first_name text;

alter table public.profiles_private drop constraint if exists profiles_private_first_name_length;
alter table public.profiles_private
  add constraint profiles_private_first_name_length
  check (first_name is null or char_length(first_name) between 1 and 40);

comment on column public.profiles_private.first_name is
  'Private first name for the vocative greeting only (E01-S13). Written via set_first_name().';

-- Returns 'ok' | 'invalid'; raises when called without a user. Blank clears.
-- Character rules mirror src/lib/first-name.ts (letters, space, - and ').
create or replace function public.set_first_name(p_first_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v text := nullif(regexp_replace(btrim(coalesce(p_first_name, '')), '\s+', ' ', 'g'), '');
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if v is not null and (char_length(v) > 40 or v !~ '^[[:alpha:]]+([ ''-][[:alpha:]]+)*$') then
    return 'invalid';
  end if;

  insert into public.profiles_private as pp (id, first_name)
  values (uid, v)
  on conflict (id) do update
    set first_name = excluded.first_name;

  return 'ok';
end;
$$;

revoke all on function public.set_first_name(text) from public, anon;
grant execute on function public.set_first_name(text) to authenticated;

-- 3. Avatars bucket ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Replaces the listing-enabling public read policy of earlier drafts.
drop policy if exists avatars_public_read on storage.objects;

-- Owner-only: storage remove() needs SELECT on the object it deletes.
drop policy if exists avatars_owner_read on storage.objects;
create policy avatars_owner_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
