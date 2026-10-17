-- E01-S23 — rolled-back production rehearsal of
-- supabase/migrations/20261017210000_author_gender_form.sql (= M).
--
-- Build the script as: `begin;` + M + this file (to rehearse together with #293:
-- `begin;` + 20261017200000_recipe_servings.sql + M + this file), then run it
-- with `supabase db query --linked --project-ref <ref> -f <script>` or the
-- Management API query endpoint. The DO block
-- always ends by RAISING REHEARSAL_RESULT, so M and every write below roll
-- back — production is left exactly as it was. Needs at least one recipe whose
-- author has a profile with a username.
--
-- The author's gender is set to 'female' inside the transaction only when it is
-- still null (set_gender's own rule); an already chosen gender is used as is.
--
-- Expected (healthy):
--   REHEARSAL_RESULT columns[ok] order_kept[ok] servings_kept[ok|skip] no_raw_columns[ok] view_form[ok]
--                    fn_form[ok] fn_unknown[ok] neutral[ok|skip] values[ok]
--                    anon_table[ok] anon_read[ok] anon_fn_grant[ok]
--                    other_user_read[ok] authed_fn[ok]

do $rehearsal$
declare
  u1 uuid;
  u2 uuid;
  uname text;
  rid bigint;
  g text;
  expected text;
  form text;
  n int;
  cols text[];
  t_cols text; t_order text; t_servings text; t_raw text; t_view text; t_fn text; t_unknown text;
  t_neutral text; t_values text; t_anon_table text; t_anon_read text; t_fn_grant text;
  t_other text; t_authed_fn text;
begin
  -- An author with a username and at least one recipe.
  select r.user_id, p.username, r.id into u1, uname, rid
  from public.recipes r
  join public.profiles p on p.id = r.user_id
  where p.username is not null
  order by r.created_at
  limit 1;
  if u1 is null then
    raise exception 'REHEARSAL_SETUP needs a recipe whose author has a username';
  end if;

  -- Give u1 a gender (only if not chosen yet — the immutability trigger allows that).
  insert into public.profiles_private as pp (id, gender, gender_set_at)
  values (u1, 'female', now())
  on conflict (id) do update
    set gender = excluded.gender, gender_set_at = excluded.gender_set_at
    where pp.gender is null;
  select gender into g from public.profiles_private where id = u1;
  expected := case g when 'female' then 'f' when 'male' then 'm' end;

  -- Shape: appended last, existing columns untouched, no raw private column.
  select array_agg(column_name::text order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';
  t_cols := case when cols[array_length(cols, 1)] = 'author_gender_form' then 'ok' else 'FAIL:' || array_to_string(cols, ',') end;
  t_order := case when cols[1:22] = array['id','slug','title','description','image_url','category','tags',
      'prep_time_minutes','cook_time_minutes','total_time_minutes','ingredients','steps','source_type',
      'source_url','source_author','times_estimated','youtube_id','created_at','author_name',
      'meta_description','author_username','gallery_count']
    then 'ok' else 'FAIL:' || array_to_string(cols, ',') end;
  -- With #293 (20261017200000) applied, servings must stay at position 23.
  t_servings := case
    when not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'recipes' and column_name = 'servings') then 'skip'
    when cols[23] = 'servings' and array_length(cols, 1) = 24 then 'ok'
    else 'FAIL:' || array_to_string(cols, ',') end;
  t_raw := case when cols && array['gender','gender_set_at','first_name','user_id'] then 'FAIL:' || array_to_string(cols, ',') else 'ok' end;

  -- Everything below runs as a guest, like PostgREST with the anon key.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';

  select author_gender_form into form from public.public_recipes where id = rid;
  t_view := case when form is not distinct from expected and form is not null then 'ok' else 'FAIL:' || coalesce(form, 'null') end;

  form := public.profile_gender_form(uname);
  t_fn := case when form is not distinct from expected and form is not null then 'ok' else 'FAIL:' || coalesce(form, 'null') end;

  form := public.profile_gender_form('no-such-user-s23-rehearsal');
  t_unknown := case when form is null then 'ok' else 'FAIL:' || form end;

  -- A recipe author without a chosen gender gets null (neutral wording).
  select v.author_gender_form into form
  from public.public_recipes v
  join public.profiles p on p.username = v.author_username
  where public.profile_gender_form(p.username) is null
  limit 1;
  get diagnostics n = row_count;
  t_neutral := case when n = 0 then 'skip' when form is null then 'ok' else 'FAIL:' || form end;

  select count(*) into n from public.public_recipes
  where author_gender_form is not null and author_gender_form not in ('f', 'm');
  t_values := case when n = 0 then 'ok' else 'FAIL:' || n end;

  -- No table privilege and no readable row for anon on profiles_private.
  t_anon_table := case
    when has_table_privilege('anon', 'public.profiles_private', 'select') then 'FAIL:select-granted'
    else 'ok' end;
  begin
    select count(*) into n from public.profiles_private;
    t_anon_read := 'FAIL:readable(' || n || ')';
  exception when insufficient_privilege then
    t_anon_read := 'ok';
  end;

  t_fn_grant := case
    when has_function_privilege('anon', 'public.profile_gender_form(text)', 'execute') then 'ok'
    else 'FAIL:no-execute' end;

  -- Another signed-in user still cannot read u1's private row, but gets the form.
  execute 'reset role';
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u2 is null then
    t_other := 'skip';
    t_authed_fn := 'skip';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.profiles_private where id = u1;
    t_other := case when n = 0 then 'ok' else 'FAIL:' || n end;
    form := public.profile_gender_form(uname);
    t_authed_fn := case when form is not distinct from expected then 'ok' else 'FAIL:' || coalesce(form, 'null') end;
  end if;

  raise exception
    'REHEARSAL_RESULT columns[%] order_kept[%] servings_kept[%] no_raw_columns[%] view_form[%] fn_form[%] fn_unknown[%] neutral[%] values[%] anon_table[%] anon_read[%] anon_fn_grant[%] other_user_read[%] authed_fn[%]',
    t_cols, t_order, t_servings, t_raw, t_view, t_fn, t_unknown, t_neutral, t_values, t_anon_table, t_anon_read,
    t_fn_grant, t_other, t_authed_fn;
end;
$rehearsal$;

rollback;
