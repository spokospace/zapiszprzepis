-- Admin panel, Phase 4 — behavioural checks for the MCP token functions.
--
-- NOT run by CI: it needs a database with 20261028100000, 20261028110000 and
-- 20261030100000 applied. Run it by hand on a SCRATCH database or a Supabase branch,
-- never on production:
--   psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/staff_tokens_guards.sql
-- It was also run in pglite (auth stubbed, those three migrations in order).
--
-- Everything happens inside one transaction that ROLLS BACK, so nothing is kept. A
-- failed check raises an exception that names it; success prints
-- "staff_tokens_guards: all checks passed".

begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  mod_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  plain_id uuid := gen_random_uuid();
  raw text;
  raw2 text;
  hash text;
  n integer;
  r record;
  tid bigint;
begin
  insert into auth.users (id) values (admin_id), (mod_id), (other_id), (plain_id);
  insert into public.user_roles (user_id, role) values (admin_id, 'admin'), (mod_id, 'moderator');

  -- 1. A token is created once; only its hash is stored.
  raw := public.admin_create_token_as(admin_id, 'laptop', 90);
  if raw !~ '^zpm_[0-9a-f]{64}$' then raise exception 'FAIL 1a: unexpected token shape'; end if;
  hash := encode(sha256(convert_to(raw, 'UTF8')), 'hex');
  select count(*) into n from public.staff_tokens where token_hash = hash and user_id = admin_id and prefix = substr(raw, 1, 8);
  if n <> 1 then raise exception 'FAIL 1b: the hash was not stored'; end if;
  select count(*) into n from public.staff_tokens where token_hash = raw or prefix = raw;
  if n <> 0 then raise exception 'FAIL 1c: the raw token was stored'; end if;
  select count(*) into n from public.staff_audit_log where before::text like '%' || raw || '%' or after::text like '%' || raw || '%';
  if n <> 0 then raise exception 'FAIL 1d: the raw token reached the audit log'; end if;
  select count(*) into n from public.staff_audit_log where actor_id = admin_id and resource = 'tokens' and operation = 'create';
  if n <> 1 then raise exception 'FAIL 1e: create was not audited'; end if;

  -- 2. A plain account cannot create one; neither can a token (via mcp).
  begin
    perform public.admin_create_token_as(plain_id, 'x', 90);
    raise exception 'FAIL 2a: a plain account created a token';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_create_token_as(admin_id, 'x', 90, 'mcp', 1);
    raise exception 'FAIL 2b: a token created a token';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  begin
    perform public.admin_create_token_as(admin_id, '  ', 90);
    raise exception 'FAIL 2c: an empty label was accepted';
  exception when others then
    if sqlerrm <> 'invalid_input' then raise; end if;
  end;

  -- 3. Resolving: the actor and the permissions the roles grant right now.
  select * into r from public.staff_resolve_token(hash);
  if r.actor_id is distinct from admin_id then raise exception 'FAIL 3a: token did not resolve to its owner'; end if;
  if not ('roles.manage' = any (r.permissions)) then raise exception 'FAIL 3b: admin permissions missing'; end if;
  tid := r.token_id;
  select count(*) into n from public.staff_resolve_token('not-a-hash');
  if n <> 0 then raise exception 'FAIL 3c: an unknown hash resolved'; end if;
  if (select last_used_at from public.staff_tokens where id = tid) is null then
    raise exception 'FAIL 3d: last_used_at was not set';
  end if;

  -- 4. A moderator's token resolves to moderator permissions only.
  raw2 := public.admin_create_token_as(mod_id, 'mod', 30);
  select * into r from public.staff_resolve_token(encode(sha256(convert_to(raw2, 'UTF8')), 'hex'));
  if r.actor_id is distinct from mod_id then raise exception 'FAIL 4a: moderator token did not resolve'; end if;
  if 'roles.manage' = any (r.permissions) or 'users.block' = any (r.permissions) then
    raise exception 'FAIL 4b: moderator token carries admin permissions';
  end if;

  -- 5. Own tokens only: listing and revoking.
  select count(*) into n from public.admin_list_tokens_as(mod_id);
  if n <> 1 then raise exception 'FAIL 5a: a moderator should see exactly their own token, saw %', n; end if;
  begin
    perform public.admin_revoke_token_as(mod_id, tid);
    raise exception 'FAIL 5b: a moderator revoked someone else''s token';
  exception when others then
    if sqlerrm <> 'not_found' then raise; end if;
  end;

  -- 6. Revoked token stops resolving at once; revoking twice is harmless.
  perform public.admin_revoke_token_as(admin_id, tid);
  perform public.admin_revoke_token_as(admin_id, tid);
  select count(*) into n from public.staff_resolve_token(hash);
  if n <> 0 then raise exception 'FAIL 6a: a revoked token resolved'; end if;
  select count(*) into n from public.staff_audit_log where resource = 'tokens' and operation = 'revoke' and target_id = tid::text;
  if n <> 1 then raise exception 'FAIL 6b: expected one revoke audit row, found %', n; end if;

  -- 7. Expired token stops resolving.
  raw := public.admin_create_token_as(admin_id, 'short', 1);
  hash := encode(sha256(convert_to(raw, 'UTF8')), 'hex');
  update public.staff_tokens set expires_at = now() - interval '1 second' where token_hash = hash;
  select count(*) into n from public.staff_resolve_token(hash);
  if n <> 0 then raise exception 'FAIL 7: an expired token resolved'; end if;

  -- 8. A banned account's token stops resolving; unbanning brings it back.
  raw := public.admin_create_token_as(admin_id, 'banned', 5);
  hash := encode(sha256(convert_to(raw, 'UTF8')), 'hex');
  update auth.users set banned_until = now() + interval '1 day' where id = admin_id;
  select count(*) into n from public.staff_resolve_token(hash);
  if n <> 0 then raise exception 'FAIL 8a: a banned account''s token resolved'; end if;
  update auth.users set banned_until = now() - interval '1 day' where id = admin_id;
  select count(*) into n from public.staff_resolve_token(hash);
  if n <> 1 then raise exception 'FAIL 8b: an expired ban should not block the token'; end if;

  -- 9. A de-roled account's token stops resolving.
  delete from public.user_roles where user_id = mod_id;
  select count(*) into n from public.staff_resolve_token(encode(sha256(convert_to(raw2, 'UTF8')), 'hex'));
  if n <> 0 then raise exception 'FAIL 9: a de-roled account''s token resolved'; end if;

  -- 10. At most ten active tokens per account.
  insert into public.user_roles (user_id, role) values (other_id, 'moderator');
  for i in 1..10 loop
    perform public.admin_create_token_as(other_id, 't' || i, 7);
  end loop;
  begin
    perform public.admin_create_token_as(other_id, 'eleventh', 7);
    raise exception 'FAIL 10: an eleventh active token was created';
  exception when others then
    if sqlerrm <> 'too_many_tokens' then raise; end if;
  end;

  -- 11. Deleting the account deletes its tokens.
  delete from auth.users where id = other_id;
  select count(*) into n from public.staff_tokens where user_id = other_id;
  if n <> 0 then raise exception 'FAIL 11: tokens survived their account'; end if;
end $$;

select public.assert_staff_tokens_grants();

do $$ begin raise notice 'staff_tokens_guards: all checks passed'; end $$;

rollback;
