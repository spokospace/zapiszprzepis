-- E01-S21b (#298) — rolled-back production rehearsal of
-- supabase/migrations/20261017220000_recipe_dish_columns.sql (= M).
--
-- Build the script as: `begin;` + M + M + this file (M twice proves the re-run is a
-- no-op), then run it with the Management API query endpoint. The DO block always
-- ends by RAISING REHEARSAL_RESULT, so M and every write below roll back —
-- production is left exactly as it was. Needs at least one recipe.
--
-- Expected (healthy):
--   REHEARSAL_RESULT columns[ok] nullable[ok] all_null[ok] checks[ok] valid_write[ok]
--                    upper_dish[ok] padded_dish[ok] acc_without_dish[ok] long_note[ok]

do $rehearsal$
declare
  rid bigint;
  n int;
  t_cols text; t_null text; t_all_null text; t_checks text; t_valid text;
  t_upper text; t_padded text; t_acc text; t_note text;
begin
  select count(*) into n
  from information_schema.columns
  where table_schema = 'public' and table_name = 'recipes'
    and (column_name, data_type) in (
      ('dish', 'text'), ('dish_accusative', 'text'), ('variant_note', 'text'),
      ('dish_classified_at', 'timestamp with time zone'));
  t_cols := case when n = 4 then 'ok' else 'FAIL(' || n || ')' end;

  select count(*) into n
  from information_schema.columns
  where table_schema = 'public' and table_name = 'recipes'
    and column_name in ('dish', 'dish_accusative', 'variant_note', 'dish_classified_at')
    and is_nullable = 'YES';
  t_null := case when n = 4 then 'ok' else 'FAIL(' || n || ')' end;

  select count(*) into n from public.recipes
  where dish is not null or dish_accusative is not null
     or variant_note is not null or dish_classified_at is not null;
  t_all_null := case when n = 0 then 'ok' else 'FAIL(' || n || ')' end;

  select count(*) into n from pg_constraint
  where conrelid = 'public.recipes'::regclass
    and conname in ('recipes_dish_format', 'recipes_dish_accusative_format', 'recipes_variant_note_length');
  t_checks := case when n = 3 then 'ok' else 'FAIL(' || n || ')' end;

  select id into rid from public.recipes order by id limit 1;
  if rid is null then
    raise exception 'REHEARSAL_SETUP no recipe';
  end if;

  begin
    update public.recipes
    set dish = 'zupa ziemniaczana', dish_accusative = 'zupę ziemniaczaną',
        variant_note = 'Na wędzonych żeberkach', dish_classified_at = now()
    where id = rid;
    t_valid := 'ok';
  exception when check_violation then
    t_valid := 'FAIL';
  end;

  begin
    update public.recipes set dish = 'Sernik', dish_accusative = null where id = rid;
    t_upper := 'FAIL(accepted)';
  exception when check_violation then
    t_upper := 'ok';
  end;

  begin
    update public.recipes set dish = ' sernik', dish_accusative = null where id = rid;
    t_padded := 'FAIL(accepted)';
  exception when check_violation then
    t_padded := 'ok';
  end;

  begin
    update public.recipes set dish = null, dish_accusative = 'szarlotkę' where id = rid;
    t_acc := 'FAIL(accepted)';
  exception when check_violation then
    t_acc := 'ok';
  end;

  begin
    update public.recipes set variant_note = repeat('x', 61) where id = rid;
    t_note := 'FAIL(accepted)';
  exception when check_violation then
    t_note := 'ok';
  end;

  raise exception 'REHEARSAL_RESULT columns[%] nullable[%] all_null[%] checks[%] valid_write[%] upper_dish[%] padded_dish[%] acc_without_dish[%] long_note[%]',
    t_cols, t_null, t_all_null, t_checks, t_valid, t_upper, t_padded, t_acc, t_note;
end
$rehearsal$;
