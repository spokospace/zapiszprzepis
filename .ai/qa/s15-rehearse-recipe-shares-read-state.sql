-- E01-S15 — rolled-back production rehearsal of
-- supabase/migrations/20261017190000_recipe_shares_read_state.sql (= M).
--
-- Build the script as `begin;` + M + this file and run it with
--   supabase db query --linked --project-ref <ref> -f <script>
-- (or the Management API query endpoint). The DO block always ends by RAISING
-- REHEARSAL_RESULT, so the migration and every write below roll back —
-- production is left exactly as it was. Needs one existing recipe_shares row.
--
-- Expected (healthy):
--   REHEARSAL_RESULT columns[ok] backfill[ok] owner_read[ok] owner_clear[ok]
--                    other_user[ok] anon[ok] index[ok]

do $rehearsal$
declare
  s_id bigint;
  owner uuid;
  other uuid;
  n int;
  t_columns text; t_backfill text; t_owner_read text; t_owner_clear text;
  t_other text; t_anon text; t_index text;
begin
  select id, user_id into s_id, owner from public.recipe_shares order by id desc limit 1;
  select id into other from auth.users where id <> owner order by created_at limit 1;
  if s_id is null or other is null then
    raise exception 'REHEARSAL_SETUP needs one recipe_shares row and a second auth user';
  end if;

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'recipe_shares' and column_name in ('read_at', 'cleared_at');
  t_columns := case when n = 2 then 'ok' else 'FAIL:' || n end;

  select count(*) into n from public.recipe_shares where status = 'completed' and read_at is null;
  t_backfill := case when n = 0 then 'ok' else 'FAIL:' || n || ' unread' end;

  -- Make the sample an unread ready share (superuser, before switching role).
  update public.recipe_shares set status = 'completed', read_at = null, cleared_at = null where id = s_id;

  -- Owner (authenticated role + JWT claims, as PostgREST does).
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.recipe_shares set read_at = now() where id = s_id and status = 'completed' and read_at is null;
  get diagnostics n = row_count;
  t_owner_read := case when n = 1 then 'ok' else 'FAIL:' || n end;

  update public.recipe_shares set cleared_at = now()
   where user_id = owner and status = 'completed' and read_at is not null and cleared_at is null and id = s_id;
  get diagnostics n = row_count;
  t_owner_clear := case when n = 1 then 'ok' else 'FAIL:' || n end;

  -- Another user cannot touch the owner's share.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  update public.recipe_shares set read_at = null where id = s_id;
  get diagnostics n = row_count;
  t_other := case when n = 0 then 'ok' else 'FAIL:' || n end;

  -- Nor can anon.
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  begin
    update public.recipe_shares set read_at = null where id = s_id;
    get diagnostics n = row_count;
    t_anon := case when n = 0 then 'ok' else 'FAIL:' || n end;
  exception when insufficient_privilege then
    t_anon := 'ok';
  end;
  execute 'reset role';

  select count(*) into n from pg_indexes
   where schemaname = 'public' and indexname = 'idx_recipe_shares_user_unread';
  t_index := case when n = 1 then 'ok' else 'FAIL' end;

  raise exception 'REHEARSAL_RESULT columns[%] backfill[%] owner_read[%] owner_clear[%] other_user[%] anon[%] index[%]',
    t_columns, t_backfill, t_owner_read, t_owner_clear, t_other, t_anon, t_index;
end
$rehearsal$;
