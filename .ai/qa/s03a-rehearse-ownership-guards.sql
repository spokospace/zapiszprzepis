-- E01-S03a Phase 1 — rolled-back production rehearsal of migration C
-- (supabase/migrations/20261017090000_recipe_ownership_guards.sql).
--
-- Build the script as: `begin;` + the migration file + this file, then run it
-- with `supabase db query --linked --project-ref <ref> -f <script>`. The DO
-- block always ends by raising REHEARSAL_RESULT, so the migration, the test
-- favorites and the test account delete all roll back. Expected:
--   T1[P0001 recipe_shared]  T2[undo-ok]  T3[undo-ok]
--   T4[owner_is_b=true fav_left=0 r2_left=0]

-- Rehearsal assertions. Ends by RAISING, so the whole transaction rolls back.
do $rehearsal$
declare
  a uuid; b uuid; r bigint; r2 bigint; r_url text;
  t1 text; t2 text; t3 text; t4 text;
  owner_after uuid; fav_left int; r2_left int;
begin
  -- A recipe R of owner A (with another recipe R2 nobody favorites), and a
  -- user B who has no copy of R's link.
  select rec.user_id, rec.id, rec.source_url into a, r, r_url
  from public.recipes rec
  where rec.source_url is not null
    and (select count(*) from public.recipes x where x.user_id = rec.user_id) >= 2
  order by rec.id limit 1;
  select rec.id into r2 from public.recipes rec where rec.user_id = a and rec.id <> r order by rec.id limit 1;
  select u.id into b from auth.users u
  where u.id <> a
    and not exists (select 1 from public.recipes x where x.user_id = u.id and x.source_url = r_url)
  order by u.created_at limit 1;

  -- T1: owner delete refused while B has it as a favorite.
  insert into public.favorites (user_id, recipe_id) values (b, r);
  begin
    delete from public.recipes where id = r;
    t1 := 'FAIL: delete went through';
  exception when others then
    t1 := sqlstate || ' ' || sqlerrm;
  end;

  -- T2: owner's own favorite does not block the delete.
  delete from public.favorites where user_id = b and recipe_id = r;
  insert into public.favorites (user_id, recipe_id) values (a, r) on conflict do nothing;
  begin
    delete from public.recipes where id = r;
    raise exception 'undo-ok';
  exception when others then
    t2 := sqlerrm;
  end;
  delete from public.favorites where user_id = a and recipe_id = r;

  -- T3: the opt-out setting lets the collapse/account path through.
  insert into public.favorites (user_id, recipe_id) values (b, r);
  begin
    perform set_config('zapiszprzepis.allow_shared_recipe_delete', 'on', true);
    delete from public.recipes where id = r;
    raise exception 'undo-ok';
  exception when others then
    t3 := sqlerrm;
  end;
  perform set_config('zapiszprzepis.allow_shared_recipe_delete', '', true);

  -- T4: deleting A hands R to B (favorite consumed), R2 goes with A.
  begin
    delete from auth.users where id = a;
    select user_id into owner_after from public.recipes where id = r;
    select count(*) into fav_left from public.favorites where user_id = b and recipe_id = r;
    select count(*) into r2_left from public.recipes where id = r2;
    t4 := format('owner_is_b=%s fav_left=%s r2_left=%s', owner_after = b, fav_left, r2_left);
    raise exception 'undo-ok';
  exception when others then
    if sqlerrm <> 'undo-ok' then t4 := 'ERROR ' || sqlstate || ' ' || sqlerrm; end if;
  end;

  raise exception 'REHEARSAL_RESULT T1[%] T2[%] T3[%] T4[%]', t1, t2, t3, t4;
end;
$rehearsal$;

rollback;
