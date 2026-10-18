-- E01-S21 — rolled-back production rehearsal of
-- supabase/migrations/20261017230000_recipe_dish_versions.sql (= M).
--
-- Build the script as: `begin;` + M + this file, then run it with
-- `supabase db query --linked --project-ref <ref> -f <script>` or the
-- Management API query endpoint. The final DO block always RAISES
-- REHEARSAL_RESULT, so M and every write below roll back — production is left
-- exactly as it was. Needs at least 3 recipes and 2 auth users.
--
-- It sets a throwaway dish on three real recipes inside the transaction, gives
-- one sibling two favorites, then exercises the view shape, the index, and both
-- RPCs (dish_versions as a guest, dish_vocabulary and the grants).
--
-- Expected (healthy):
--   REHEARSAL_RESULT view_tail[ok] index[ok] versions_rows[ok] versions_order[ok]
--                    versions_total[ok] versions_no_self[ok] vocab[ok]
--                    anon_versions_grant[ok] anon_vocab_denied[ok]
--                    service_vocab_grant[ok] view_grant[ok] anon_call[ok]

do $rehearsal$
declare
  rid1 bigint; rid2 bigint; rid3 bigint;
  u1 uuid; u2 uuid;
  cols text[];
  n int;
  first_id bigint;
  total int;
  cnt int;
  t_tail text; t_index text; t_rows text; t_order text; t_total text; t_no_self text;
  t_vocab text; t_anon_v text; t_anon_voc text; t_svc_voc text; t_view_grant text; t_anon_call text;
begin
  select id into rid1 from public.recipes order by id limit 1;
  select id into rid2 from public.recipes where id <> rid1 order by id limit 1;
  select id into rid3 from public.recipes where id not in (rid1, rid2) order by id limit 1;
  if rid3 is null then
    raise exception 'REHEARSAL_SETUP needs at least 3 recipes';
  end if;
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u2 is null then
    raise exception 'REHEARSAL_SETUP needs at least 2 auth users';
  end if;

  -- A throwaway dish on all three (lowercase, passes recipes_dish_format).
  update public.recipes set dish = 's21rehearsaldanie', dish_accusative = 's21rehearsaldanie',
         variant_note = 'Wersja rehearsalowa', dish_classified_at = now()
  where id in (rid1, rid2, rid3);

  -- rid2 gets two favorites, rid3 none, so rid2 sorts first by favorites_count.
  insert into public.favorites (user_id, recipe_id) values (u1, rid2), (u2, rid2)
  on conflict do nothing;

  -- View tail: the last five columns stay servings, author_gender_form, then the
  -- three appended S21 columns in order.
  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  n := array_length(cols, 1);
  t_tail := case when cols[n-4:n] = array['servings','author_gender_form','dish','dish_accusative','variant_note']
    then 'ok' else 'FAIL:' || array_to_string(cols, ',') end;

  t_index := case when exists (
      select 1 from pg_indexes where schemaname = 'public' and tablename = 'recipes' and indexname = 'recipes_dish_idx'
    ) then 'ok' else 'FAIL:no-index' end;

  -- Grants (checked before switching role).
  t_anon_v := case when has_function_privilege('anon', 'public.dish_versions(bigint)', 'execute') then 'ok' else 'FAIL:no-exec' end;
  t_anon_voc := case when has_function_privilege('anon', 'public.dish_vocabulary()', 'execute') then 'FAIL:granted' else 'ok' end;
  t_svc_voc := case when has_function_privilege('service_role', 'public.dish_vocabulary()', 'execute') then 'ok' else 'FAIL:no-exec' end;
  t_view_grant := case when has_table_privilege('anon', 'public.public_recipes', 'select') then 'ok' else 'FAIL:no-select' end;

  -- dish_vocabulary groups: the throwaway dish has exactly 3 recipes.
  select recipes into cnt from public.dish_vocabulary() where dish = 's21rehearsaldanie';
  t_vocab := case when cnt = 3 then 'ok' else 'FAIL:' || coalesce(cnt::text, 'null') end;

  -- dish_versions as a guest (SECURITY DEFINER reads recipes/favorites past RLS).
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';

  select count(*)::int into total from public.dish_versions(rid1);
  t_rows := case when total = 2 then 'ok' else 'FAIL:' || total end;

  select v.id, v.total_count into first_id, total from public.dish_versions(rid1) v
  order by v.favorites_count desc, v.created_at desc, v.id desc limit 1;
  t_order := case when first_id = rid2 then 'ok' else 'FAIL:first=' || coalesce(first_id::text, 'null') end;
  t_total := case when total = 2 then 'ok' else 'FAIL:' || coalesce(total::text, 'null') end;

  select count(*)::int into cnt from public.dish_versions(rid1) v where v.id = rid1;
  t_no_self := case when cnt = 0 then 'ok' else 'FAIL:self-returned' end;

  select count(*)::int into cnt from public.dish_versions(rid1);
  t_anon_call := case when cnt = 2 then 'ok' else 'FAIL:' || cnt end;

  execute 'reset role';

  raise exception
    'REHEARSAL_RESULT view_tail[%] index[%] versions_rows[%] versions_order[%] versions_total[%] versions_no_self[%] vocab[%] anon_versions_grant[%] anon_vocab_denied[%] service_vocab_grant[%] view_grant[%] anon_call[%]',
    t_tail, t_index, t_rows, t_order, t_total, t_no_self, t_vocab, t_anon_v, t_anon_voc, t_svc_voc, t_view_grant, t_anon_call;
end;
$rehearsal$;

rollback;
