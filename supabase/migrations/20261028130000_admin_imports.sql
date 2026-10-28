-- Admin panel, Phase 1 — the import queue: failed and stuck imports, and retry.
-- Spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md (API Contracts, Imports)
--
-- Today a failed import is visible only in the Inngest logs and in the bell of the
-- user who shared the link. Staff with imports.read see all of them; staff with
-- imports.retry can send one back through the existing `recipe/extract` event.
--
-- Same layout as admin_users: `_as` functions for service_role (the MCP), thin
-- wrappers for authenticated (the panel). The retry function validates, resets the
-- share to pending and audits in one transaction, and RETURNS the event payload;
-- the app layer then sends the event, exactly as src/app/(authenticated)/recipes/
-- retry-action.ts does for an owner. If the send fails the app calls
-- admin_import_dispatch_failed so the share does not sit in `pending` unseen.
--
-- A share counts as stuck when it has been `pending` for more than 15 minutes
-- (STALE_PENDING_MS in src/lib/share-staleness.ts — keep the two in step).
--
-- Also adds the staff SELECT policy on recipe_shares (writes stay owner/service).
--
-- Requires 20261028100000 and 20261028110000. Applied only with the owner's
-- explicit go (local development points at the production database).
--
-- Idempotent: safe to re-run.

-- ── Staff read access ───────────────────────────────────────────────────────
-- Additive: the owner policies stay as they are. (select ...) lets Postgres
-- evaluate the permission once per statement instead of once per row.
drop policy if exists recipe_shares_staff_select on public.recipe_shares;
create policy recipe_shares_staff_select
  on public.recipe_shares
  for select
  to authenticated
  using ((select public.has_permission('imports.read')));

-- ── Row type ────────────────────────────────────────────────────────────────
do $$
begin
  create type public.admin_import_row as (
    share_id bigint,
    user_id uuid,
    username text,
    display_name text,
    shared_url text,
    status text,
    error_message text,
    attempts integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    recipe_id bigint,
    stuck boolean
  );
exception when duplicate_object then null;
end $$;

-- ── Read ────────────────────────────────────────────────────────────────────
-- p_status: 'problem' (failed or stuck, the default), 'failed', 'pending',
-- 'completed' or 'all'. Newest first; keyset paging by share id.
create or replace function public.admin_list_imports_as(
  p_actor uuid,
  p_status text default 'problem',
  p_limit integer default 50,
  p_before_id bigint default null
)
returns setof public.admin_import_row
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.staff_can(p_actor, 'imports.read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('problem', 'failed', 'pending', 'completed', 'all') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  return query
    select
      s.id,
      s.user_id,
      p.username,
      p.display_name,
      s.shared_url,
      s.status::text,
      s.error_message,
      s.attempts,
      s.created_at,
      s.updated_at,
      s.recipe_id,
      (s.status = 'pending' and s.updated_at < now() - interval '15 minutes')
    from public.recipe_shares s
    left join public.profiles p on p.id = s.user_id
    where (p_before_id is null or s.id < p_before_id)
      and case p_status
        when 'problem' then s.status = 'failed' or (s.status = 'pending' and s.updated_at < now() - interval '15 minutes')
        when 'all' then true
        else s.status::text = p_status
      end
    order by s.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

-- ── Retry ───────────────────────────────────────────────────────────────────
-- Returns the payload of the `recipe/extract` event, unchanged in shape:
--   { shareId, sharedUrl, sharedTitle, sharedText, userId }
-- Only a failed share, or a pending one stuck for 15+ minutes, is retryable.
-- A share another retry already moved on is refused with 'not_retryable', so a
-- double click cannot dispatch twice.
create or replace function public.admin_retry_import_as(
  p_actor uuid,
  p_share bigint,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.recipe_shares%rowtype;
begin
  if not public.staff_can(p_actor, 'imports.retry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into s from public.recipe_shares where id = p_share for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (s.status = 'failed' or (s.status = 'pending' and s.updated_at < now() - interval '15 minutes')) then
    raise exception 'not_retryable' using errcode = '22023';
  end if;

  update public.recipe_shares set status = 'pending', error_message = null where id = s.id;

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'imports', 'retry', s.id::text,
    jsonb_build_object('status', s.status::text, 'attempts', s.attempts),
    jsonb_build_object('status', 'pending')
  );

  return jsonb_build_object(
    'shareId', s.id,
    'sharedUrl', s.shared_url,
    'sharedTitle', s.share_intent ->> 'title',
    'sharedText', s.share_intent ->> 'text',
    'userId', s.user_id
  );
end;
$$;

-- The event could not be sent: put the share back to failed with the same Polish
-- text the owner's retry uses, so it stays visible. Only a share this actor just
-- reset (pending, untouched since) is changed.
create or replace function public.admin_import_dispatch_failed_as(
  p_actor uuid,
  p_share bigint,
  p_via text default 'panel',
  p_token_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.staff_can(p_actor, 'imports.retry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.recipe_shares
  set status = 'failed',
      error_message = 'Nie udało się ponowić przetwarzania. Spróbuj ponownie.'
  where id = p_share and status = 'pending' and updated_at > now() - interval '1 minute';

  perform public.staff_audit(
    p_actor, p_via, p_token_id, 'imports', 'retry_dispatch_failed', p_share::text, null,
    jsonb_build_object('status', 'failed')
  );
end;
$$;

-- ── Panel wrappers (the caller's own session) ───────────────────────────────

create or replace function public.admin_list_imports(
  p_status text default 'problem',
  p_limit integer default 50,
  p_before_id bigint default null
)
returns setof public.admin_import_row
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.admin_list_imports_as(auth.uid(), p_status, p_limit, p_before_id)
$$;

create or replace function public.admin_retry_import(p_share bigint)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.admin_retry_import_as(auth.uid(), p_share, 'panel', null)
$$;

create or replace function public.admin_import_dispatch_failed(p_share bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_import_dispatch_failed_as(auth.uid(), p_share, 'panel', null)
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_list_imports_as(uuid, text, integer, bigint) from public, anon, authenticated;
revoke all on function public.admin_retry_import_as(uuid, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_import_dispatch_failed_as(uuid, bigint, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_imports(text, integer, bigint) from public, anon, authenticated;
revoke all on function public.admin_retry_import(bigint) from public, anon, authenticated;
revoke all on function public.admin_import_dispatch_failed(bigint) from public, anon, authenticated;

grant execute on function public.admin_list_imports_as(uuid, text, integer, bigint) to service_role;
grant execute on function public.admin_retry_import_as(uuid, bigint, text, bigint) to service_role;
grant execute on function public.admin_import_dispatch_failed_as(uuid, bigint, text, bigint) to service_role;
grant execute on function public.admin_list_imports(text, integer, bigint) to authenticated;
grant execute on function public.admin_retry_import(bigint) to authenticated;
grant execute on function public.admin_import_dispatch_failed(bigint) to authenticated;

-- ── Assertions ──────────────────────────────────────────────────────────────
create or replace function public.assert_admin_imports_grants()
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_list_imports_as(uuid,text,integer,bigint)',
    'public.admin_retry_import_as(uuid,bigint,text,bigint)',
    'public.admin_import_dispatch_failed_as(uuid,bigint,text,bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'admin imports grant check: % is executable by an API role', f;
    end if;
  end loop;
  foreach f in array array[
    'public.admin_list_imports(text,integer,bigint)',
    'public.admin_retry_import(bigint)',
    'public.admin_import_dispatch_failed(bigint)'
  ] loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'admin imports grant check: anon can execute %', f;
    end if;
  end loop;
  -- The staff policy must not have widened writes: authenticated keeps its existing
  -- owner-scoped policies only, and no policy of ours is for insert/update/delete.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipe_shares'
      and policyname = 'recipe_shares_staff_select' and cmd <> 'SELECT'
  ) then
    raise exception 'admin imports grant check: recipe_shares_staff_select is not select-only';
  end if;
end;
$$;

revoke all on function public.assert_admin_imports_grants() from public, anon, authenticated;

select public.assert_admin_imports_grants();

-- ── Down (manual, owner-run) ────────────────────────────────────────────────
-- drop function public.assert_admin_imports_grants(), public.admin_import_dispatch_failed(bigint),
--   public.admin_retry_import(bigint), public.admin_list_imports(text, integer, bigint),
--   public.admin_import_dispatch_failed_as(uuid, bigint, text, bigint),
--   public.admin_retry_import_as(uuid, bigint, text, bigint),
--   public.admin_list_imports_as(uuid, text, integer, bigint);
-- drop type public.admin_import_row;
-- drop policy recipe_shares_staff_select on public.recipe_shares;
