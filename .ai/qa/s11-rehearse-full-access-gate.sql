-- E01-S11 — rolled-back production rehearsal of
-- supabase/migrations/20261017140000_full_access_gate.sql.
--
-- Build the script as: `begin;` + the migration file + this file, then run it
-- with `supabase db query --linked --project-ref <ref> -f <script>`. The DO
-- block always ends by RAISING REHEARSAL_RESULT, so the migration, the two
-- throwaway auth users, the codes and every write roll back. Expected:
--   T1[invalid] T2[42501] T3[ok] T4[t] T5[insert-ok] T6[invalid] T7[invalid]
--   T8[rate_limited] T9[42501] T10[own_rows=1] T11[42501] T12[already]
--   T13[uses=1 by_b=1] T14[recipes 42501] grandfathered=<n> users=<n>

do $rehearsal$
declare
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  code_one bigint;
  t1 text; t2 text; t3 text; t4 text; t5 text; t6 text; t7 text;
  t8 text; t9 text; t10 text; t11 text; t12 text; t13 text; t14 text;
  i int;
  n int;
  grandfathered int;
  users int;
begin
  -- Two throwaway accounts with no recipes, so the backfill gave them nothing.
  insert into auth.users (id, email, aud, role)
  values (b, 'rehearsal-s11-b@example.invalid', 'authenticated', 'authenticated'),
         (c, 'rehearsal-s11-c@example.invalid', 'authenticated', 'authenticated');

  code_one := public.create_access_code('Rehearsal-Code-01', 1, null, 'rehearsal');
  perform public.create_access_code('RehearsalExpired9', 5, now() - interval '1 day', 'rehearsal');

  select count(*) into grandfathered from public.user_full_access where source = 'grandfathered';
  select count(*) into users from auth.users;

  -- Act as B (a signed-in API user).
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  -- T1: an unknown code.
  t1 := public.redeem_access_code('nope-nope-nope');

  -- T2: no access yet → RLS refuses a share insert.
  begin
    insert into public.recipe_shares (user_id, shared_url, share_intent, status, attempts)
    values (b, 'https://example.invalid/s11', '{}'::jsonb, 'pending', 0);
    t2 := 'FAIL: insert went through';
  exception when others then
    t2 := sqlstate;
  end;

  -- T3: case and whitespace do not matter.
  t3 := public.redeem_access_code('  rehearsal - CODE-01 ');
  -- T4: B now has full access.
  t4 := public.has_full_access()::text;

  -- T5: the share insert now passes RLS.
  begin
    insert into public.recipe_shares (user_id, shared_url, share_intent, status, attempts)
    values (b, 'https://example.invalid/s11', '{}'::jsonb, 'pending', 0);
    t5 := 'insert-ok';
  exception when others then
    t5 := 'FAIL ' || sqlstate || ' ' || sqlerrm;
  end;

  -- T10: B reads only their own entitlement row.
  select count(*) into n from public.user_full_access;
  t10 := 'own_rows=' || n;

  -- T12: a second redemption by B consumes nothing.
  t12 := public.redeem_access_code('Rehearsal-Code-01');

  -- Act as C.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', c::text, true);
  set local role authenticated;

  -- T6: the single-use code is spent.
  t6 := public.redeem_access_code('Rehearsal-Code-01');
  -- T7: an expired code.
  t7 := public.redeem_access_code('RehearsalExpired9');
  -- T8: 2 failures so far; 3 more reach 5, then the next call is rate limited.
  for i in 1..3 loop
    perform public.redeem_access_code('wrong-code-' || i);
  end loop;
  t8 := public.redeem_access_code('anything-at-all');

  -- T11: C cannot grant themselves access directly.
  begin
    insert into public.user_full_access (user_id, source) values (c, 'code');
    t11 := 'FAIL: self-grant went through';
  exception when others then
    t11 := sqlstate;
  end;

  -- T14: C (no access) cannot insert a recipe directly either.
  begin
    insert into public.recipes (user_id, title, slug, source_type)
    values (c, 'Rehearsal', 'rehearsal-s11', 'other');
    t14 := 'FAIL: recipe insert went through';
  exception when others then
    t14 := 'recipes ' || sqlstate;
  end;

  -- T9: anon cannot read the codes table.
  reset role;
  set local role anon;
  begin
    perform 1 from public.access_codes limit 1;
    t9 := 'FAIL: anon read codes';
  exception when others then
    t9 := sqlstate;
  end;
  reset role;

  -- T13: the code counter and the "used by" trail.
  select format('uses=%s by_b=%s', ac.use_count,
                (select count(*) from public.access_code_redemptions r where r.code_id = ac.id and r.user_id = b))
    into t13
  from public.access_codes ac where ac.id = code_one;

  raise exception 'REHEARSAL_RESULT T1[%] T2[%] T3[%] T4[%] T5[%] T6[%] T7[%] T8[%] T9[%] T10[%] T11[%] T12[%] T13[%] T14[%] grandfathered=% users=%',
    t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14, grandfathered, users;
end;
$rehearsal$;

rollback;
