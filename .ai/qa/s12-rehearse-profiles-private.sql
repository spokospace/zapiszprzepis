-- E01-S12 — rolled-back production rehearsal of
-- supabase/migrations/20261017130000_profiles_private_gender.sql (= M).
--
-- Build the script as: `begin;` + M + this file, then run it with
-- `supabase db query --linked --project-ref <ref> -f <script>`. The DO block
-- always ends by RAISING REHEARSAL_RESULT, so M and every write below roll
-- back — production is left exactly as it was. Needs two existing auth users.
--
-- Expected (healthy):
--   REHEARSAL_RESULT invalid[ok] first_write[ok] second_write[ok] kept[ok]
--                    owner_read[ok] other_read[ok] direct_update[ok]
--                    trigger[ok] anon_read[ok] no_auth[ok]

do $rehearsal$
declare
  u1 uuid;
  u2 uuid;
  r text;
  n int;
  g text;
  t_invalid text; t_first text; t_second text; t_kept text; t_owner text;
  t_other text; t_update text; t_trigger text; t_anon text; t_noauth text;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null or u2 is null then
    raise exception 'REHEARSAL_SETUP needs two auth users';
  end if;

  -- Act as u1 (authenticated role + JWT claims, like PostgREST does).
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  r := public.set_gender('other');
  t_invalid := case when r = 'invalid' then 'ok' else 'FAIL:' || r end;

  r := public.set_gender('female');
  t_first := case when r = 'ok' then 'ok' else 'FAIL:' || r end;

  r := public.set_gender('male');
  t_second := case when r = 'already_set' then 'ok' else 'FAIL:' || r end;

  select gender into g from public.profiles_private where id = u1;
  t_kept := case when g = 'female' then 'ok' else 'FAIL:' || coalesce(g, 'null') end;

  select count(*) into n from public.profiles_private;
  t_owner := case when n = 1 then 'ok' else 'FAIL:' || n end;

  -- A direct write must be refused (no update grant / policy).
  begin
    update public.profiles_private set gender = 'male' where id = u1;
    get diagnostics n = row_count;
    t_update := case when n = 0 then 'ok' else 'FAIL:updated' end;
  exception when insufficient_privilege then
    t_update := 'ok';
  end;

  -- Another user cannot see u1's row.
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles_private where id = u1;
  t_other := case when n = 0 then 'ok' else 'FAIL:' || n end;

  -- No user at all → set_gender raises.
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.set_gender('male');
    t_noauth := 'FAIL:no-raise';
  exception when others then
    t_noauth := 'ok';
  end;

  -- anon cannot read the table at all.
  execute 'set local role anon';
  begin
    select count(*) into n from public.profiles_private;
    t_anon := 'FAIL:readable(' || n || ')';
  exception when insufficient_privilege then
    t_anon := 'ok';
  end;

  -- Even the table owner cannot change a chosen gender (trigger).
  execute 'reset role';
  begin
    update public.profiles_private set gender = 'male' where id = u1;
    t_trigger := 'FAIL:changed';
  exception when others then
    t_trigger := case when sqlerrm like 'gender is immutable%' then 'ok' else 'FAIL:' || sqlerrm end;
  end;

  raise exception
    'REHEARSAL_RESULT invalid[%] first_write[%] second_write[%] kept[%] owner_read[%] other_read[%] direct_update[%] trigger[%] anon_read[%] no_auth[%]',
    t_invalid, t_first, t_second, t_kept, t_owner, t_other, t_update, t_trigger, t_anon, t_noauth;
end;
$rehearsal$;

rollback;
