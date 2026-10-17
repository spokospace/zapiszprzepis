-- E01-S05 — rolled-back production rehearsal of
-- supabase/migrations/20261017160000_search_recipes.sql (= M).
--
-- Build the script as: `begin;` + M + this file, then run it with
-- `supabase db query --linked --project-ref <ref> -f <script>`. The DO block always
-- ends by RAISING REHEARSAL_RESULT, so M, the two throwaway users, their recipes and
-- the favorite all roll back — production is left exactly as it was.
--
-- Fixture: user A owns "Rehearsal Zzqx pierogi" (ingredient "qwzx-marchew", newer);
-- user B owns "Rehearsal Zzqx sernik qwzx" (ingredient "qwzx_lit%"); A favorites B's.
--
-- Expected (healthy):
--   REHEARSAL_RESULT anon_all[2/2] anon_mine[0] anon_fav[0] ingredient[1] words[1/1]
--     rank[title-first] literal_pct[1] literal_wild[0] a_mine[A] a_fav[B] bad_scope[22023]
--     empty[0] index[ok] grants[ok] total_real[<n>]

do $rehearsal$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ra bigint;
  rb bigint;
  anon_all text; anon_mine int; anon_fav int; ingredient int; words text; rank text;
  literal_pct int; literal_wild int; a_mine text; a_fav text; bad_scope text; empty int;
  has_index boolean; anon_exec boolean; public_exec boolean; total_real int;
begin
  insert into auth.users (id, email, aud, role)
  values (a, 'rehearsal-s05-a@example.invalid', 'authenticated', 'authenticated'),
         (b, 'rehearsal-s05-b@example.invalid', 'authenticated', 'authenticated');

  insert into public.recipes (user_id, title, slug, source_type, category, ingredients, created_at)
  values (b, 'Rehearsal Zzqx sernik qwzx', 'rehearsal-s05-zzqx-b', 'other', 'inne',
          '[{"name": "qwzx_lit%"}, {"amount": "1"}, "loose string"]'::jsonb, now() - interval '1 day')
  returning id into rb;
  insert into public.recipes (user_id, title, slug, source_type, category, ingredients)
  values (a, 'Rehearsal Zzqx pierogi', 'rehearsal-s05-zzqx-a', 'other', 'inne',
          '[{"name": "Qwzx-Marchew", "amount": "2"}]'::jsonb)
  returning id into ra;
  insert into public.favorites (user_id, recipe_id) values (a, rb);

  select count(*) into total_real from public.recipes where slug not like 'rehearsal-s05-%';

  -- As a guest.
  set local role anon;
  select count(*) || '/' || coalesce(max(total_count), 0) into anon_all from public.search_recipes('zzqx', 'all', 14);
  select count(*) into anon_mine from public.search_recipes('zzqx', 'mine', 14);
  select count(*) into anon_fav from public.search_recipes('zzqx', 'fav', 14);
  select count(*) into ingredient from public.search_recipes('QWZX-marchew', 'all', 14);
  select (select count(*) from public.search_recipes('zzqx  pierogi', 'all', 14)) || '/' ||
         (select count(*) from public.search_recipes('pierogi zzqx', 'all', 14)) into words;
  -- B is older but a title hit; A matches 'qwzx' only through its ingredient.
  select case when array_agg(id order by ord) = array[rb, ra] then 'title-first' else 'FAIL' end into rank
    from public.search_recipes('qwzx', 'all', 14) with ordinality as t(id, slug, title, image_url, category, description,
      source_type, source_url, source_author, total_time_minutes, prep_time_minutes, cook_time_minutes, created_at, total_count, ord);
  select count(*) into literal_pct from public.search_recipes('qwzx_lit%', 'all', 14);
  select count(*) into literal_wild from public.search_recipes('qwzx%lit', 'all', 14);
  select count(*) into empty from public.search_recipes('   ', 'all', 14);
  begin
    perform public.search_recipes('zzqx', 'everything', 14);
    bad_scope := 'FAIL: accepted';
  exception when sqlstate '22023' then
    bad_scope := '22023';
  end;
  reset role;

  -- As user A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select case when array_agg(id) = array[ra] then 'A' else 'FAIL:' || coalesce(array_agg(id)::text, 'none') end
    into a_mine from public.search_recipes('zzqx', 'mine', 14);
  select case when array_agg(id) = array[rb] then 'B' else 'FAIL:' || coalesce(array_agg(id)::text, 'none') end
    into a_fav from public.search_recipes('zzqx', 'fav', 14);
  reset role;

  select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'recipes_search_text_trgm_idx')
    into has_index;
  anon_exec := has_function_privilege('anon', 'public.search_recipes(text, text, integer)', 'EXECUTE');
  public_exec := exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'search_recipes' and grantee = 'PUBLIC');

  raise exception
    'REHEARSAL_RESULT anon_all[%] anon_mine[%] anon_fav[%] ingredient[%] words[%] rank[%] literal_pct[%] literal_wild[%] a_mine[%] a_fav[%] bad_scope[%] empty[%] index[%] grants[%] total_real[%]',
    anon_all, anon_mine, anon_fav, ingredient, words, rank, literal_pct, literal_wild, a_mine, a_fav, bad_scope, empty,
    case when has_index then 'ok' else 'FAIL' end,
    case when anon_exec and not public_exec then 'ok' else 'FAIL' end,
    total_real;
end;
$rehearsal$;

rollback;
