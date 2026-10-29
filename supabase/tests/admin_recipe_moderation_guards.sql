-- Admin panel, Phase 2 — behavioural checks for recipe moderation.
--
-- NOT run by CI: it needs a database with the Phase 1 and Phase 2 migrations applied. Run it by
-- hand on a SCRATCH database or a Supabase branch, never on production:
--   psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_recipe_moderation_guards.sql
--
-- It creates throwaway accounts and recipes inside one transaction and ROLLS BACK at the end, so
-- nothing is kept. Any failed check raises an exception that names it; success prints
-- "admin_recipe_moderation_guards: all checks passed".
--
-- Verified against PGlite with the real migrations replayed in order (auth, storage and the
-- Supabase roles stubbed); not yet run on a Supabase database.

begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  mod_id uuid := gen_random_uuid();
  plain_id uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  fav_id uuid := gen_random_uuid();
  r1 bigint; r2 bigint; r3 bigint; r4 bigint;
  n integer;
  txt text;
  j jsonb;
  the_merge uuid;
  fav_before integer;
begin
  insert into auth.users (id, email) values
    (admin_id, 'admin@mod.invalid'), (mod_id, 'mod@mod.invalid'), (plain_id, 'plain@mod.invalid'),
    (owner_id, 'owner@mod.invalid'), (fav_id, 'fav@mod.invalid');
  insert into public.user_roles (user_id, role) values (admin_id, 'admin'), (mod_id, 'moderator');

  insert into public.recipes (user_id, title, slug, source_type, source_url, category, tags)
  values (owner_id, 'Zupa pomidorowa', 'zupa-pomidorowa-mod', 'web_blog', 'https://mod.invalid/1', 'zupy', '{}') returning id into r1;
  insert into public.recipes (user_id, title, slug, source_type, source_url, category, tags)
  values (owner_id, 'Rosol', 'rosol-mod', 'web_blog', 'https://mod.invalid/2', 'zupy', '{}') returning id into r2;
  insert into public.recipes (user_id, title, slug, source_type, source_url, category, tags)
  values (owner_id, 'Sernik', 'sernik-mod', 'web_blog', 'https://mod.invalid/3', 'obiady', '{}') returning id into r3;
  -- A duplicate of r3 under another link (the global unique index forbids the same one).
  insert into public.recipes (user_id, title, slug, source_type, source_url, category, tags)
  values (fav_id, 'Sernik drugi', 'sernik-drugi-mod', 'web_blog', 'https://mod.invalid/3-copy', 'obiady', '{}') returning id into r4;
  insert into public.favorites (user_id, recipe_id) values (fav_id, r1), (plain_id, r1), (plain_id, r4);

  -- 1. Hiding needs recipes.hide.
  begin
    perform public.admin_hide_recipe_as(plain_id, r1);
    raise exception 'FAIL 1a: a plain account hid a recipe';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_hide_recipe_as(mod_id, -1);
    raise exception 'FAIL 1b: hiding a missing recipe succeeded';
  exception when others then
    if sqlerrm <> 'not_found' then raise; end if;
  end;

  -- 2. A hidden recipe leaves both public views, search and the facets, for guests and signed-in users.
  if public.admin_hide_recipe_as(mod_id, r1, 'test') <> 'zupa-pomidorowa-mod' then raise exception 'FAIL 2a: hide returned the wrong slug'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select count(*) into n from public.public_recipes where id = r1;
  if n <> 0 then raise exception 'FAIL 2b: anon reads a hidden recipe from public_recipes'; end if;
  select count(*) into n from public.public_recipes where id = r2;
  if n <> 1 then raise exception 'FAIL 2c: a visible recipe vanished from public_recipes'; end if;
  select count(*) into n from public.search_recipes('pomidorowa', 'all', 20);
  if n <> 0 then raise exception 'FAIL 2d: search_recipes returns a hidden recipe'; end if;
  reset role;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  set local role authenticated;
  select count(*) into n from public.recipe_gallery_images where id = r1;
  if n <> 0 then raise exception 'FAIL 2e: the gallery view returns a hidden recipe'; end if;
  select count(*) into n from public.search_recipes('pomidorowa', 'mine', 20);
  if n <> 0 then raise exception 'FAIL 2f: the "mine" scope returns a hidden recipe (accepted omission)'; end if;
  select count(*) into n from public.recipes where id = r1;
  if n <> 1 then raise exception 'FAIL 2g: the owner can no longer read their own hidden recipe'; end if;
  reset role;

  -- 2h. dish_versions (SECURITY DEFINER, callable by anon) leaves a hidden sibling out.
  update public.recipes set dish = 'zupa', dish_accusative = 'zupe' where id in (r1, r2);
  set local role anon;
  select count(*) into n from public.dish_versions(r2);
  reset role;
  if n <> 0 then raise exception 'FAIL 2h: dish_versions returns a hidden sibling'; end if;
  set local role anon;
  select count(*) into n from public.dish_versions(r1);
  reset role;
  if n <> 0 then raise exception 'FAIL 2i: dish_versions answers for a hidden recipe'; end if;

  -- 3. The owner and a favoriter learn it is unavailable; others do not.
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  set local role authenticated;
  if not public.recipe_hidden_for_viewer('zupa-pomidorowa-mod') then raise exception 'FAIL 3a: the owner is not told'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', fav_id::text, true);
  set local role authenticated;
  if not public.recipe_hidden_for_viewer('zupa-pomidorowa-mod') then raise exception 'FAIL 3b: a favoriter is not told'; end if;
  select count(*) into n from public.recipes where id = r1;
  if n <> 0 then raise exception 'FAIL 3c: a favoriter reads a hidden recipe from the table'; end if;
  select count(*) into n from public.favorites f left join public.public_recipes p on p.id = f.recipe_id where f.user_id = fav_id and p.id is null;
  if n <> 1 then raise exception 'FAIL 3d: the favorite of a hidden recipe should embed as null'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  if public.recipe_hidden_for_viewer('zupa-pomidorowa-mod') then raise exception 'FAIL 3e: staff who neither own nor favorite are told'; end if;
  reset role;
  set local role anon;
  begin
    perform public.recipe_hidden_for_viewer('zupa-pomidorowa-mod');
    raise exception 'FAIL 3f: anon can call recipe_hidden_for_viewer';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 4. Staff read hidden recipes through the table; a non-staff account does not.
  perform set_config('request.jwt.claim.sub', mod_id::text, true);
  set local role authenticated;
  select count(*) into n from public.recipes where id = r1;
  if n <> 1 then raise exception 'FAIL 4a: a moderator cannot read a hidden recipe'; end if;
  select count(*) into n from public.admin_list_recipes('pomidorowa', 'hidden');
  if n <> 1 then raise exception 'FAIL 4b: the hidden filter did not find the recipe'; end if;
  select count(*) into n from public.admin_list_recipes('pomidorowa', 'visible');
  if n <> 0 then raise exception 'FAIL 4c: the visible filter returned a hidden recipe'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', plain_id::text, true);
  set local role authenticated;
  select count(*) into n from public.recipes where id = r1;
  if n <> 0 then raise exception 'FAIL 4d: a plain account reads someone else''s recipe'; end if;
  begin
    perform * from public.admin_list_recipes();
    raise exception 'FAIL 4e: a plain account listed recipes';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_hide_recipe(r2);
    raise exception 'FAIL 4f: a plain account hid a recipe through the wrapper';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_hide_recipe_as(plain_id, r2);
    raise exception 'FAIL 4g: the internal function is callable by authenticated';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 5. The audit row exists and carries no personal data.
  select count(*) into n from public.staff_audit_log where actor_id = mod_id and operation = 'hide' and target_id = r1::text;
  if n <> 1 then raise exception 'FAIL 5a: expected one hide audit row, found %', n; end if;
  select count(*) into n from public.staff_audit_log where before::text ilike '%mod.invalid%' or after::text ilike '%mod.invalid%';
  if n <> 0 then raise exception 'FAIL 5b: an e-mail address reached the audit log'; end if;

  -- 6. The boundary assertion fails when the filter is dropped or hidden_* is exposed.
  begin
    create or replace view public.recipe_gallery_images with (security_invoker = false) as
      select r.id, r.image_urls from public.recipes r;
    perform public.assert_public_view_boundary();
    raise exception 'FAIL 6a: the boundary assertion accepted a gallery view without the filter';
  exception when others then
    if sqlerrm not like 'assert_public_view_boundary:%' then raise; end if;
  end;
  select count(*) into n from public.recipe_gallery_images where id = r1;  -- the failed block rolled the view back
  if n <> 0 then raise exception 'FAIL 6b: the view was left unfiltered'; end if;
  begin
    execute 'create or replace view public.public_recipes with (security_invoker = false) as '
      || regexp_replace(pg_get_viewdef('public.public_recipes'::regclass), 'WHERE \(r\.hidden_at IS NULL\)', '');
    perform public.assert_public_view_boundary();
    raise exception 'FAIL 6c: the boundary assertion accepted public_recipes without the filter';
  exception when others then
    if sqlerrm not like 'assert_public_view_boundary:%' then raise; end if;
  end;

  -- 7. Unhide brings it back and is audited.
  if public.admin_unhide_recipe_as(mod_id, r1) <> 'zupa-pomidorowa-mod' then raise exception 'FAIL 7a: unhide returned the wrong slug'; end if;
  set local role anon;
  select count(*) into n from public.public_recipes where id = r1;
  reset role;
  if n <> 1 then raise exception 'FAIL 7b: an unhidden recipe is not public again'; end if;

  -- 8. Delete: the redirect must be a visible recipe; the archive keeps the row; favorites go; restore is exact.
  perform public.admin_hide_recipe_as(mod_id, r2);
  begin
    perform public.admin_delete_recipe_as(mod_id, r3, 'rosol-mod');
    raise exception 'FAIL 8a: a redirect to a hidden recipe was accepted';
  exception when others then
    if sqlerrm <> 'invalid_redirect' then raise; end if;
  end;
  begin
    perform public.admin_delete_recipe_as(mod_id, r3, 'no-such-recipe');
    raise exception 'FAIL 8b: a redirect to a missing recipe was accepted';
  exception when others then
    if sqlerrm <> 'invalid_redirect' then raise; end if;
  end;
  perform public.admin_unhide_recipe_as(mod_id, r2);

  -- r1 has two favorites from other users (fav_id, plain_id): the owner guard would refuse, staff delete works.
  select count(*) into fav_before from public.favorites where recipe_id = r1;
  if fav_before <> 2 then raise exception 'FAIL 8c: setup, expected 2 favorites, found %', fav_before; end if;
  begin
    delete from public.recipes where id = r1;
    raise exception 'FAIL 8d: the owner guard did not refuse a shared delete';
  exception when others then
    if sqlerrm <> 'recipe_shared' then raise; end if;
  end;
  if public.admin_delete_recipe_as(mod_id, r1, 'rosol-mod') <> 'zupa-pomidorowa-mod' then raise exception 'FAIL 8e: delete returned the wrong slug'; end if;
  select count(*) into n from public.recipes where id = r1;
  if n <> 0 then raise exception 'FAIL 8f: the recipe is still there'; end if;
  select count(*) into n from public.recipes_deleted_by_staff where recipe_id = r1 and redirect_to_slug = 'rosol-mod' and favorite_count = 2 and row_data ->> 'title' = 'Zupa pomidorowa';
  if n <> 1 then raise exception 'FAIL 8g: the archive row is wrong'; end if;
  select count(*) into n from public.favorites where recipe_id = r1;
  if n <> 0 then raise exception 'FAIL 8h: favorites of a deleted recipe remain'; end if;
  select count(*) into n from public.staff_audit_log where operation = 'delete' and target_id = r1::text and (after ->> 'redirect_to') = 'rosol-mod';
  if n <> 1 then raise exception 'FAIL 8i: the delete was not audited'; end if;
  -- The archive is not reachable through the API.
  set local role authenticated;
  begin
    perform 1 from public.recipes_deleted_by_staff;
    raise exception 'FAIL 8j: authenticated reads the archive';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 9. Restore puts it back, once; a taken slug refuses.
  select count(*) into n from public.admin_list_deleted_recipes_as(mod_id) where recipe_id = r1;
  if n <> 1 then raise exception 'FAIL 9a: the deleted list does not show the recipe'; end if;
  begin
    perform public.admin_restore_recipe_as(mod_id, r1);
    raise exception 'FAIL 9b: a moderator restored a recipe (admin only)';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  insert into public.recipes (user_id, title, slug, source_type, source_url, category, tags)
  values (owner_id, 'Squatter', 'zupa-pomidorowa-mod', 'web_blog', 'https://mod.invalid/squat', 'zupy', '{}');
  begin
    perform public.admin_restore_recipe_as(admin_id, r1);
    raise exception 'FAIL 9c: restore over a taken slug succeeded';
  exception when others then
    if sqlerrm <> 'slug_taken' then raise; end if;
  end;
  delete from public.recipes where slug = 'zupa-pomidorowa-mod';
  if public.admin_restore_recipe_as(admin_id, r1) <> 'zupa-pomidorowa-mod' then raise exception 'FAIL 9d: restore returned the wrong slug'; end if;
  select count(*) into n from public.recipes where id = r1 and title = 'Zupa pomidorowa' and source_url = 'https://mod.invalid/1';
  if n <> 1 then raise exception 'FAIL 9e: the restored row differs'; end if;
  begin
    perform public.admin_restore_recipe_as(admin_id, r1);
    raise exception 'FAIL 9f: a second restore succeeded';
  exception when others then
    if sqlerrm <> 'not_found' then raise; end if;
  end;

  -- 10. Merge: needs recipes.merge, refuses a hidden canonical, moves favorites; unmerge restores.
  begin
    perform public.admin_merge_recipes_as(plain_id, r3, array[r4]);
    raise exception 'FAIL 10a: a plain account merged recipes';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_merge_recipes_as(mod_id, r3, array[r3]);
    raise exception 'FAIL 10b: a recipe was merged into itself';
  exception when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
  end;
  perform public.admin_hide_recipe_as(mod_id, r3);
  begin
    perform public.admin_merge_recipes_as(mod_id, r3, array[r4]);
    raise exception 'FAIL 10c: a hidden canonical was accepted';
  exception when others then
    if sqlerrm <> 'canonical_hidden' then raise; end if;
  end;
  perform public.admin_unhide_recipe_as(mod_id, r3);

  j := public.admin_merge_recipes_as(mod_id, r3, array[r4]);
  the_merge := (j ->> 'merge_id')::uuid;
  if j ->> 'canonical_slug' <> 'sernik-mod' or (j -> 'loser_slugs' ->> 0) <> 'sernik-drugi-mod' then raise exception 'FAIL 10d: merge result %', j; end if;
  select count(*) into n from public.recipes where id = r4;
  if n <> 0 then raise exception 'FAIL 10e: the loser is still there'; end if;
  select count(*) into n from public.favorites where user_id = plain_id and recipe_id = r3;
  if n <> 1 then raise exception 'FAIL 10f: the loser''s favorite did not move to the canonical'; end if;
  select count(*) into n from public.admin_list_merges_as(mod_id, r3);
  if n <> 1 then raise exception 'FAIL 10g: the merge is not listed'; end if;

  begin
    perform public.admin_unmerge_as(plain_id, the_merge);
    raise exception 'FAIL 10h: a plain account unmerged';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  j := public.admin_unmerge_as(mod_id, the_merge);
  select count(*) into n from public.recipes where id = r4 and slug = 'sernik-drugi-mod';
  if n <> 1 then raise exception 'FAIL 10i: the loser did not come back'; end if;
  select count(*) into n from public.favorites where user_id = plain_id and recipe_id = r4;
  if n <> 1 then raise exception 'FAIL 10j: the favorite did not move back'; end if;
  select count(*) into n from public.favorites where user_id = fav_id and recipe_id = r3;
  if n <> 0 then raise exception 'FAIL 10k: the owner''s created favorite was not removed'; end if;
  select count(*) into n from public.recipes_merged_duplicates where merge_id = the_merge;
  if n <> 0 then raise exception 'FAIL 10l: the merge archive was not cleared'; end if;
  begin
    perform public.admin_unmerge_as(mod_id, the_merge);
    raise exception 'FAIL 10m: a second unmerge succeeded';
  exception when others then
    if sqlerrm <> 'not_found' then raise; end if;
  end;

  -- 10n. A loser that shared its link with the canonical comes back without it (the unique index).
  insert into public.recipes (user_id, title, slug, source_type, source_url, category, tags)
  values (fav_id, 'Zupa grzybowa', 'zupa-grzybowa-mod', 'web_blog', 'https://mod.invalid/g1', 'zupy', '{}') returning id into r2;
  j := public.admin_merge_recipes_as(mod_id, r1, array[r2]);
  update public.recipes set source_url = 'https://mod.invalid/g1' where id = r1;  -- the canonical now holds the loser's old link
  perform public.admin_unmerge_as(mod_id, (j ->> 'merge_id')::uuid);
  select count(*) into n from public.recipes where id = r2 and source_url is null;
  if n <> 1 then raise exception 'FAIL 10n: the restored loser should come back without the taken link'; end if;
  select count(*) into n from public.staff_audit_log where operation = 'unmerge' and (after -> 'dropped') @> '[{"field":"source_url"}]'::jsonb;
  if n <> 1 then raise exception 'FAIL 10o: the dropped link was not audited'; end if;

  -- 11. Taxonomy: validated in SQL, applied, audited.
  begin
    perform public.admin_set_taxonomy_as(plain_id, r1, 'zupy', null);
    raise exception 'FAIL 11a: a plain account changed the taxonomy';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_set_taxonomy_as(mod_id, r1, 'no_such_category', null);
    raise exception 'FAIL 11b: an unknown category was accepted';
  exception when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
  end;
  begin
    perform public.admin_set_taxonomy_as(mod_id, r1, null, array['Not A Slug']);
    raise exception 'FAIL 11c: a free-text tag was accepted';
  exception when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
  end;
  begin
    perform public.admin_set_taxonomy_as(mod_id, r1, null, array['a','b','c','d','e','f','g']);
    raise exception 'FAIL 11d: seven tags were accepted';
  exception when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
  end;
  begin
    perform public.admin_set_taxonomy_as(mod_id, r1, null, null);
    raise exception 'FAIL 11e: an empty change was accepted';
  exception when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
  end;
  perform public.admin_set_taxonomy_as(mod_id, r1, 'obiady', array['grill','szybkie']);
  select count(*) into n from public.recipes where id = r1 and category = 'obiady' and tags = array['grill','szybkie'];
  if n <> 1 then raise exception 'FAIL 11f: the taxonomy was not applied'; end if;
  perform public.admin_set_taxonomy_as(mod_id, r1, null, '{}');
  select count(*) into n from public.recipes where id = r1 and category = 'obiady' and tags = '{}';
  if n <> 1 then raise exception 'FAIL 11g: an empty tag array should clear the tags and keep the category'; end if;

  raise notice 'admin_recipe_moderation_guards: all checks passed';
end;
$$;

rollback;
