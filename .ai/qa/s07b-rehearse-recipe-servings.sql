-- E01-S07b follow-up — rolled-back production rehearsal of
-- supabase/migrations/20261017220000_recipe_servings.sql (= M).
--
-- Build the script as: `begin;` + [S23] + M + M + this file + `rollback;`, and send
-- it to the Management API query endpoint (or `supabase db query --linked -f`).
-- M runs twice to prove it is idempotent. [S23] is
-- 20261017210000_author_gender_form.sql (PR #291), included for the second run
-- to prove the two view appends coexist in apply order. The DO block always ends
-- by RAISING REHEARSAL_RESULT, so M, the throwaway user and its recipe all roll
-- back even if the trailing `rollback;` were never reached.
--
-- Expected (healthy):
--   REHEARSAL_RESULT type[smallint] check[ok] range[0:23514 100:23514 null:ok]
--     view_head[ok] view_tail[...,gallery_count,servings] or
--     [...,gallery_count,author_gender_form,servings] (with S23)
--     fixture_view[4] anon_grant[ok] anon_read[ok] search[ok]
--     recipes[<n>] servings_null[<n>]

do $rehearsal$
declare
  u uuid := gen_random_uuid();
  rid bigint;
  col_type text; has_check boolean; low text; high text; nul text;
  head_ok boolean; tail text; fixture int; anon_select boolean; anon_insert boolean;
  anon_read text; search_ok text; total_real int; null_real int;
begin
  -- Before the fixture, so the counts are production's own rows.
  select count(*), count(*) filter (where servings is null) into total_real, null_real from public.recipes;

  select data_type into col_type from information_schema.columns
  where table_schema = 'public' and table_name = 'recipes' and column_name = 'servings';
  has_check := exists (
    select 1 from pg_constraint
    where conname = 'recipes_servings_range' and conrelid = 'public.recipes'::regclass
  );

  -- The first 22 view columns keep their names and positions (select('*') consumers).
  select string_agg(column_name, ',' order by ordinal_position) = 'id,slug,title,description,image_url,'
      || 'category,tags,prep_time_minutes,cook_time_minutes,total_time_minutes,ingredients,steps,'
      || 'source_type,source_url,source_author,times_estimated,youtube_id,created_at,author_name,'
      || 'meta_description,author_username,gallery_count'
    into head_ok
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes' and ordinal_position <= 22;
  select string_agg(column_name, ',' order by ordinal_position) into tail
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes' and ordinal_position >= 22;

  insert into auth.users (id, email, aud, role)
  values (u, 'rehearsal-s07b-servings@example.invalid', 'authenticated', 'authenticated');
  insert into public.recipes (user_id, title, slug, source_type, category, ingredients, servings)
  values (u, 'Rehearsal Zzqx servings', 'rehearsal-s07b-zzqx-servings', 'other', 'inne', '[]'::jsonb, 4)
  returning id into rid;
  select servings into fixture from public.public_recipes where id = rid;

  begin
    update public.recipes set servings = 0 where id = rid;
    low := 'ACCEPTED';
  exception when check_violation then low := sqlstate;
  end;
  begin
    update public.recipes set servings = 100 where id = rid;
    high := 'ACCEPTED';
  exception when check_violation then high := sqlstate;
  end;
  begin
    update public.recipes set servings = null where id = rid;
    nul := 'ok';
  exception when others then nul := sqlstate;
  end;

  anon_select := has_column_privilege('anon', 'public.public_recipes', 'servings', 'SELECT');
  anon_insert := has_table_privilege('anon', 'public.public_recipes', 'INSERT');

  -- Read the new column and run the search as anon itself, not just check grants.
  set local role anon;
  begin
    perform count(servings) from public.public_recipes;
    anon_read := 'ok';
  exception when others then anon_read := sqlstate;
  end;
  begin
    perform * from public.search_recipes('zzqx', 'all', 5);
    search_ok := 'ok';
  exception when others then search_ok := sqlstate;
  end;
  reset role;

  raise exception
    'REHEARSAL_RESULT type[%] check[%] range[0:% 100:% null:%] view_head[%] view_tail[%] fixture_view[%] anon_grant[%] anon_read[%] search[%] recipes[%] servings_null[%]',
    col_type,
    case when has_check then 'ok' else 'FAIL' end,
    low, high, nul,
    case when head_ok then 'ok' else 'FAIL' end,
    tail,
    fixture,
    case when anon_select and not anon_insert then 'ok' else 'FAIL' end,
    anon_read, search_ok, total_real, null_real;
end
$rehearsal$;
