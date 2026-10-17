-- E01-S03b — rolled-back production rehearsal of the slug-uniqueness migrations
-- (supabase/migrations/20261017120000_slug_global_unique_backfill.sql = A and
--  supabase/migrations/20261017120100_recipes_slug_global_index.sql = B).
--
-- Build the script as: `begin;` + migration A + migration B + this file, then run
-- it with `supabase db query --linked --project-ref <ref> -f <script>`. The DO
-- block always ends by RAISING REHEARSAL_RESULT, so A, B and the assertions all
-- roll back — production is left exactly as it was. This proves, on real data,
-- that A resolves every collision and B's global index then builds cleanly.
--
-- Expected (healthy): all checks "ok", dupes=0, and renamed = however many
-- same-slug losers production had. If B could not build, the whole script fails
-- at B (before this file) — meaning A left a duplicate, which must be fixed.
--
--   REHEARSAL_RESULT dupes[0] uniq_index[ok] per_user_dropped[ok]
--                    renames_resolve[ok] oldest_kept[ok] renamed[<n>]

do $rehearsal$
declare
  dupes int;
  uniq_index text;
  per_user int;
  renamed int;
  bad_resolve int;
  bad_oldest int;
begin
  -- A1: no slug is used by more than one row any more.
  select count(*) into dupes
  from (select 1 from public.recipes group by slug having count(*) > 1) d;

  -- A2: the global unique index exists; the per-user unique constraint is gone.
  uniq_index := case when to_regclass('public.recipes_slug_uniq') is not null then 'ok' else 'MISSING' end;
  select count(*) into per_user
  from pg_constraint where conname = 'recipes_user_id_slug_key';

  -- A3: every logged rename now carries its new slug and that slug is unique.
  select count(*) into renamed from public.recipe_slug_rename_log;
  select count(*) into bad_resolve
  from public.recipe_slug_rename_log l
  where not exists (select 1 from public.recipes r where r.id = l.recipe_id and r.slug = l.new_slug)
     or (select count(*) from public.recipes r where r.slug = l.new_slug) <> 1;

  -- A4: for each renamed group the bare slug is still held by exactly one row,
  --     and that keeper is older (created_at, then id) than every renamed loser.
  select count(*) into bad_oldest
  from public.recipe_slug_rename_log l
  join public.recipes loser on loser.id = l.recipe_id
  where not exists (
    select 1 from public.recipes keeper
    where keeper.slug = l.old_slug
      and (keeper.created_at, keeper.id) < (loser.created_at, loser.id)
  )
  or (select count(*) from public.recipes k where k.slug = l.old_slug) <> 1;

  raise exception
    'REHEARSAL_RESULT dupes[%] uniq_index[%] per_user_dropped[%] renames_resolve[%] oldest_kept[%] renamed[%]',
    dupes,
    uniq_index,
    case when per_user = 0 then 'ok' else 'STILL-PRESENT' end,
    case when bad_resolve = 0 then 'ok' else 'FAIL:' || bad_resolve end,
    case when bad_oldest = 0 then 'ok' else 'FAIL:' || bad_oldest end,
    renamed;
end;
$rehearsal$;

rollback;
