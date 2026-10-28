-- Admin panel, Phase 1 — behavioural checks for the guards the migrations enforce.
--
-- NOT run by CI: it needs a database with the Phase 1 migrations applied. Run it by
-- hand on a SCRATCH database or a Supabase branch, never on production:
--   psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_staff_guards.sql
--
-- It creates throwaway accounts inside one transaction and ROLLS BACK at the end, so
-- nothing is kept. Any failed check raises an exception that names it; success prints
-- "admin_staff_guards: all checks passed".
--
-- Written alongside the migrations and not yet run against a database (the owner has
-- not applied them). Treat a first failure as possibly a bug in this script too.

begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  mod_id uuid := gen_random_uuid();
  manager_id uuid := gen_random_uuid();
  plain_id uuid := gen_random_uuid();
  banned timestamp with time zone;
  n integer;
  rows_seen integer;
  leaked text;
begin
  insert into auth.users (id, email) values
    (admin_id, 'admin@guards.invalid'),
    (mod_id, 'mod@guards.invalid'),
    (manager_id, 'manager@guards.invalid'),
    (plain_id, 'plain@guards.invalid');

  -- A role that may manage roles but is not admin, to test the last-admin rule.
  insert into public.staff_roles (name, description) values ('guard_manager', 'test only');
  insert into public.staff_role_permissions (role, permission) values ('guard_manager', 'roles.manage');

  insert into public.user_roles (user_id, role) values
    (admin_id, 'admin'), (mod_id, 'moderator'), (manager_id, 'guard_manager');

  -- 1. Own role cannot be changed.
  begin
    perform public.admin_set_role_as(admin_id, admin_id, 'admin', false);
    raise exception 'FAIL 1: an admin changed their own role';
  exception when others then
    if sqlerrm <> 'cannot_change_own_role' then raise; end if;
  end;

  -- 2. The last admin cannot be removed (by someone else with roles.manage).
  begin
    perform public.admin_set_role_as(manager_id, admin_id, 'admin', false);
    raise exception 'FAIL 2: the last admin was removed';
  exception when others then
    if sqlerrm <> 'last_admin' then raise; end if;
  end;

  -- 3. With a second admin the first can go.
  perform public.admin_set_role_as(admin_id, plain_id, 'admin', true);
  perform public.admin_set_role_as(manager_id, admin_id, 'admin', false);
  select count(*) into n from public.user_roles where role = 'admin';
  if n <> 1 then raise exception 'FAIL 3: expected exactly one admin left, found %', n; end if;
  -- Put the original admin back for the remaining checks.
  perform public.admin_set_role_as(manager_id, admin_id, 'admin', true);
  -- The plain account is a plain account again (it is blocked and deleted below).
  perform public.admin_set_role_as(manager_id, plain_id, 'admin', false);

  -- 4. A moderator cannot read the audit log nor block anyone.
  begin
    perform * from public.admin_list_audit_as(mod_id);
    raise exception 'FAIL 4a: a moderator read the audit log';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_block_user_as(mod_id, manager_id);
    raise exception 'FAIL 4b: a moderator blocked an account';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;

  -- 5. Nobody blocks or deletes themselves or a staff member.
  begin
    perform public.admin_block_user_as(admin_id, admin_id);
    raise exception 'FAIL 5a: an admin blocked themselves';
  exception when others then
    if sqlerrm <> 'cannot_target_self' then raise; end if;
  end;
  begin
    perform public.admin_delete_user_as(admin_id, mod_id);
    raise exception 'FAIL 5b: a staff account was deleted';
  exception when others then
    if sqlerrm <> 'cannot_target_staff' then raise; end if;
  end;

  -- 6. Blocking a plain account sets banned_until and is audited without personal data.
  perform public.admin_block_user_as(admin_id, plain_id, 'test');
  select banned_until into banned from auth.users where id = plain_id;
  if banned is null or banned <= now() then raise exception 'FAIL 6a: banned_until not set'; end if;
  select count(*) into n from public.staff_audit_log where actor_id = admin_id and operation = 'block' and target_id = plain_id::text;
  if n <> 1 then raise exception 'FAIL 6b: expected one block audit row, found %', n; end if;
  select count(*) into n from public.staff_audit_log where before::text ilike '%guards.invalid%' or after::text ilike '%guards.invalid%';
  if n <> 0 then raise exception 'FAIL 6c: an e-mail address reached the audit log'; end if;
  perform public.admin_unblock_user_as(admin_id, plain_id);
  select banned_until into banned from auth.users where id = plain_id;
  if banned is not null then raise exception 'FAIL 6d: unblock did not clear banned_until'; end if;

  -- 7. A moderator sees accounts but never e-mail, and cannot search by it.
  select count(*) into rows_seen from public.admin_list_users_as(mod_id, 'plain@guards');
  if rows_seen <> 0 then raise exception 'FAIL 7a: a moderator found an account by e-mail'; end if;
  select email into leaked from public.admin_list_users_as(mod_id, null, 100) where user_id = plain_id;
  if leaked is not null then raise exception 'FAIL 7b: a moderator saw an e-mail address'; end if;
  select email into leaked from public.admin_list_users_as(admin_id, null, 100) where user_id = plain_id;
  if leaked is distinct from 'plain@guards.invalid' then raise exception 'FAIL 7c: an admin should see the e-mail'; end if;

  -- 8. The audit writer refuses personal data and secrets.
  begin
    perform public.staff_audit(admin_id, 'panel', null, 'users', 'x', null, jsonb_build_object('email', 'a@b.c'), null);
    raise exception 'FAIL 8: an e-mail key was accepted';
  exception when others then
    if sqlerrm not like 'staff_audit:%' then raise; end if;
  end;

  -- 9. A generated access code is never stored or logged in the clear.
  declare
    code text := public.admin_create_access_code_as(admin_id, 'guards', 1, null);
  begin
    if length(code) <> 19 then raise exception 'FAIL 9a: unexpected code shape %', code; end if;
    select count(*) into n from public.staff_audit_log where before::text like '%' || code || '%' or after::text like '%' || code || '%';
    if n <> 0 then raise exception 'FAIL 9b: the code reached the audit log'; end if;
    select count(*) into n from public.access_codes where code_hash = public.access_code_hash(code);
    if n <> 1 then raise exception 'FAIL 9c: the code hash was not stored'; end if;
  end;

  -- 10. Import retry is refused for a share that is neither failed nor stuck.
  declare
    share_id bigint;
  begin
    insert into public.recipe_shares (user_id, shared_url, share_intent, status)
    values (plain_id, 'https://guards.invalid/ok', '{}'::jsonb, 'completed')
    returning id into share_id;
    begin
      perform public.admin_retry_import_as(mod_id, share_id);
      raise exception 'FAIL 10: a completed import was retried';
    exception when others then
      if sqlerrm <> 'not_retryable' then raise; end if;
    end;
  end;

  raise notice 'admin_staff_guards: all checks passed';
end;
$$;

rollback;
