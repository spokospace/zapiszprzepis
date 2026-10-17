-- E01-S07 — rolled-back production rehearsal of
-- supabase/migrations/20261017150000_public_recipes_author_username_gallery_count.sql (= M).
--
-- Build the script as: `begin;` + M + this file, then run it with
-- `supabase db query --linked --project-ref <ref> -f <script>`. M only redefines a
-- view (no row changes), and the DO block always ends by RAISING REHEARSAL_RESULT,
-- so M and the assertions roll back — production is left exactly as it was.
--
-- Expected (healthy):
--   REHEARSAL_RESULT columns[ok] order_kept[ok] grants[ok] count_matches[ok]
--                    no_urls[ok] usernames[ok] rows[<n>] with_gallery[<n>]

do $rehearsal$
declare
  cols text[];
  bad_count int;
  missing_username int;
  total int;
  with_gallery int;
  anon_select boolean;
  anon_insert boolean;
begin
  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';

  -- gallery_count equals the real gallery size for every recipe.
  select count(*) into bad_count
  from public.public_recipes v
  join public.recipes r on r.id = v.id
  where v.gallery_count <> coalesce(cardinality(r.image_urls), 0);

  -- every recipe whose author has a profile exposes that username.
  select count(*) into missing_username
  from public.public_recipes v
  join public.recipes r on r.id = v.id
  join public.profiles p on p.id = r.user_id
  where v.author_username is distinct from p.username;

  select count(*), count(*) filter (where gallery_count > 1) into total, with_gallery
  from public.public_recipes;

  anon_select := has_table_privilege('anon', 'public.public_recipes', 'SELECT');
  anon_insert := has_table_privilege('anon', 'public.public_recipes', 'INSERT');

  raise exception
    'REHEARSAL_RESULT columns[%] order_kept[%] grants[%] count_matches[%] no_urls[%] usernames[%] rows[%] with_gallery[%]',
    case when cols[21:22] = array['author_username', 'gallery_count'] then 'ok' else 'FAIL:' || array_to_string(cols, ',') end,
    case when cols[1:20] = array['id','slug','title','description','image_url','category','tags','prep_time_minutes',
      'cook_time_minutes','total_time_minutes','ingredients','steps','source_type','source_url','source_author',
      'times_estimated','youtube_id','created_at','author_name','meta_description'] then 'ok' else 'FAIL' end,
    case when anon_select and not anon_insert then 'ok' else 'FAIL' end,
    case when bad_count = 0 then 'ok' else 'FAIL:' || bad_count end,
    case when 'image_urls' <> all (cols) and 'user_id' <> all (cols) then 'ok' else 'FAIL' end,
    case when missing_username = 0 then 'ok' else 'FAIL:' || missing_username end,
    total,
    with_gallery;
end;
$rehearsal$;

rollback;
