-- E01-S13 — rolled-back production rehearsal of
-- supabase/migrations/20261017181300_profile_avatar_first_name.sql (= M).
--
-- M needs public.profiles_private (S12, 20261017130000). Build the script as:
--   `begin;` + 20261017130000_profiles_private_gender.sql (idempotent) + M + this file
-- and run it with `supabase db query --linked --project-ref <ref> -f <script>`.
-- The DO block always ends by RAISING REHEARSAL_RESULT, so the migrations and
-- every write below roll back — production is left exactly as it was. Needs
-- two existing auth users.
--
-- Expected (healthy):
--   REHEARSAL_RESULT name_ok[ok] polish[ok] compound[ok] digits[ok] too_long[ok]
--                    gender_untouched[ok] clear[ok] gender_after[ok] other_read[ok]
--                    direct_write[ok] no_auth[ok] anon_read[ok] anon_rpc[ok]
--                    color_ok[ok] color_range[ok] own_path[ok] foreign_path[ok]
--                    bucket[ok] storage_own[ok] storage_foreign[ok] anon_profiles[ok]

do $rehearsal$
declare
  u1 uuid;
  u2 uuid;
  r text;
  n int;
  v text;
  g text;
  t_name text; t_polish text; t_compound text; t_digits text; t_long text;
  t_gender text; t_clear text; t_gender_after text; t_other text; t_direct text;
  t_noauth text; t_anon text; t_anon_rpc text; t_color text; t_color_range text;
  t_own_path text; t_foreign_path text; t_bucket text; t_st_own text; t_st_foreign text;
  t_anon_profiles text;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null or u2 is null then
    raise exception 'REHEARSAL_SETUP needs two auth users';
  end if;

  select gender into g from public.profiles_private where id = u1;

  -- Act as u1 (authenticated role + JWT claims, like PostgREST does).
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  r := public.set_first_name('  Ania  ');
  select first_name into v from public.profiles_private where id = u1;
  t_name := case when r = 'ok' and v = 'Ania' then 'ok' else 'FAIL:' || r || '/' || coalesce(v, 'null') end;

  r := public.set_first_name('Łucja');
  select first_name into v from public.profiles_private where id = u1;
  t_polish := case when r = 'ok' and v = 'Łucja' then 'ok' else 'FAIL:' || r || '/' || coalesce(v, 'null') end;

  r := public.set_first_name('Anna-Maria O''Neil');
  t_compound := case when r = 'ok' then 'ok' else 'FAIL:' || r end;

  r := public.set_first_name('Ania2');
  t_digits := case when r = 'invalid' then 'ok' else 'FAIL:' || r end;

  r := public.set_first_name(repeat('a', 41));
  t_long := case when r = 'invalid' then 'ok' else 'FAIL:' || r end;

  -- Writing the first name never touches gender.
  select gender into v from public.profiles_private where id = u1;
  t_gender := case when v is not distinct from g then 'ok' else 'FAIL:' || coalesce(v, 'null') end;

  r := public.set_first_name('   ');
  select first_name into v from public.profiles_private where id = u1;
  t_clear := case when r = 'ok' and v is null then 'ok' else 'FAIL:' || r || '/' || coalesce(v, 'set') end;

  -- A row created by set_first_name still lets set_gender make the one choice.
  if g is null then
    r := public.set_gender('female');
    t_gender_after := case when r = 'ok' then 'ok' else 'FAIL:' || r end;
  else
    t_gender_after := 'ok';  -- already chosen in production; nothing to prove
  end if;

  -- No direct write path on profiles_private.
  begin
    update public.profiles_private set first_name = 'X' where id = u1;
    get diagnostics n = row_count;
    t_direct := case when n = 0 then 'ok' else 'FAIL:updated' end;
  exception when insufficient_privilege then
    t_direct := 'ok';
  end;

  -- Avatar columns on the user's own profile row.
  update public.profiles set avatar_color = 3 where id = u1;
  get diagnostics n = row_count;
  t_color := case when n = 1 then 'ok' else 'FAIL:' || n end;

  begin
    update public.profiles set avatar_color = 6 where id = u1;
    t_color_range := 'FAIL:accepted';
  exception when check_violation then
    t_color_range := 'ok';
  end;

  update public.profiles set avatar_path = u1::text || '/1760000000000.jpg' where id = u1;
  get diagnostics n = row_count;
  t_own_path := case when n = 1 then 'ok' else 'FAIL:' || n end;

  begin
    update public.profiles set avatar_path = u2::text || '/1760000000000.jpg' where id = u1;
    t_foreign_path := 'FAIL:accepted';
  exception when check_violation then
    t_foreign_path := 'ok';
  end;

  -- Storage: own folder writable, someone else's folder refused.
  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', u1::text || '/1.jpg', u1);
    t_st_own := 'ok';
  exception when others then
    t_st_own := 'FAIL:' || sqlerrm;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', u2::text || '/1.jpg', u1);
    t_st_foreign := 'FAIL:accepted';
  exception when insufficient_privilege then
    t_st_foreign := 'ok';
  end;

  -- Another user cannot read u1's private row.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles_private where id = u1;
  t_other := case when n = 0 then 'ok' else 'FAIL:' || n end;

  -- No user at all → set_first_name raises.
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.set_first_name('Ania');
    t_noauth := 'FAIL:no-raise';
  exception when others then
    t_noauth := 'ok';
  end;

  execute 'set local role anon';
  begin
    select count(*) into n from public.profiles_private;
    t_anon := 'FAIL:readable(' || n || ')';
  exception when insufficient_privilege then
    t_anon := 'ok';
  end;
  begin
    perform public.set_first_name('Ania');
    t_anon_rpc := 'FAIL:executed';
  exception when insufficient_privilege then
    t_anon_rpc := 'ok';
  end;
  -- The picture is public by design: anon reads it from profiles.
  select avatar_color into n from public.profiles where id = u1;
  t_anon_profiles := case when n = 3 then 'ok' else 'FAIL:' || coalesce(n::text, 'null') end;

  execute 'reset role';
  select count(*) into n from storage.buckets
   where id = 'avatars' and public and file_size_limit = 1048576;
  t_bucket := case when n = 1 then 'ok' else 'FAIL:' || n end;

  raise exception
    'REHEARSAL_RESULT name_ok[%] polish[%] compound[%] digits[%] too_long[%] gender_untouched[%] clear[%] gender_after[%] other_read[%] direct_write[%] no_auth[%] anon_read[%] anon_rpc[%] color_ok[%] color_range[%] own_path[%] foreign_path[%] bucket[%] storage_own[%] storage_foreign[%] anon_profiles[%]',
    t_name, t_polish, t_compound, t_digits, t_long, t_gender, t_clear, t_gender_after, t_other, t_direct,
    t_noauth, t_anon, t_anon_rpc, t_color, t_color_range, t_own_path, t_foreign_path, t_bucket,
    t_st_own, t_st_foreign, t_anon_profiles;
end;
$rehearsal$;

rollback;
