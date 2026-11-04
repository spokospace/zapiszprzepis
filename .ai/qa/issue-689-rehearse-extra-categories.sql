-- Rehearsal for 20261104100000_recipe_extra_categories.sql (issue #689).
-- Run AFTER the migration inside the same transaction (begin; <migration>; <this file>).
-- Ends with a raise, so everything rolls back; the error text is the result.
do $$
declare
  r text := '';
  v_id bigint;
  v_cat public.recipe_category;
  v_other public.recipe_category;
  n_before bigint;
  n_after bigint;
begin
  -- 1. The view exposes extra_categories last and still hides hidden recipes.
  r := r || 'view_last[' || (select case when column_name = 'extra_categories' then 'ok' else 'FAIL:' || column_name end
    from information_schema.columns where table_schema = 'public' and table_name = 'public_recipes'
    order by ordinal_position desc limit 1) || '] ';
  perform public.assert_public_view_boundary();

  -- 2. Constraint: a 3-element value and a repeated primary are rejected.
  select id, category into v_id, v_cat from public.recipes order by id limit 1;
  select value::public.recipe_category into v_other
    from unnest(enum_range(null::public.recipe_category)) as value where value <> v_cat limit 1;
  begin
    update public.recipes set extra_categories = array[v_cat] where id = v_id;
    r := r || 'primary_rejected[FAIL] ';
  exception when check_violation then r := r || 'primary_rejected[ok] ';
  end;
  begin
    update public.recipes set extra_categories = array(select e from unnest(enum_range(null::public.recipe_category)) e where e <> v_cat limit 3) where id = v_id;
    r := r || 'three_rejected[FAIL] ';
  exception when check_violation then r := r || 'three_rejected[ok] ';
  end;

  -- 3. A valid extra puts the recipe into the other list's count and facets.
  select count(*) into n_before from public.public_recipes where category = v_other or extra_categories @> array[v_other];
  update public.recipes set extra_categories = array[v_other] where id = v_id;
  select count(*) into n_after from public.public_recipes where category = v_other or extra_categories @> array[v_other];
  r := r || 'membership[' || case when n_after = n_before + 1 or (select hidden_at is not null from public.recipes where id = v_id) then 'ok' else 'FAIL' end || '] ';

  -- 4. The RPCs still answer.
  perform * from public.category_tag_facets(v_other, '{}');
  perform * from public.search_recipes('a', 'all', 3);
  perform * from public.recipe_category_context(v_id);
  r := r || 'rpcs[ok] ';

  -- 5. Grants: the API roles cannot run the admin function.
  r := r || 'grants[' || case when has_function_privilege('anon', 'public.admin_set_taxonomy_as(uuid,bigint,text,text[],text,bigint,text[])', 'execute') then 'FAIL' else 'ok' end || ']';

  raise exception 'REHEARSAL_RESULT %', r;
end $$;
