-- E02-S01 (#369) — lock down direct writes to recipes and recipe_shares.
-- Audit findings D1, C6 (context/foundation/code-audit-2026-10-20.md).
--
-- The app never writes `recipes` with a user's session; only Inngest does,
-- with the service role (which bypasses RLS and table grants). Yet the owner
-- RLS policies on `recipes` (recipes_owner_insert / recipes_owner_update,
-- 20261017140000) and on `recipe_shares` (recipe_shares_owner_update) allow a
-- signed-in user to write every column over PostgREST with the publishable key
-- and their own JWT. That lets a full-access user:
--   - rewrite the title or source_url of a recipe others have favourited,
--   - repoint „Oryginał" to any site,
--   - squat a popular link by rewriting recipe_shares.shared_url, so later
--     adders of that link land on their content.
-- Separately (C6), „Ponów" (retryShare) never checked full access — gated in
-- the app in this same change (src/app/(authenticated)/recipes/retry-action.ts).
--
-- Fix (pragmatic — owner decision 2026-10-20): close the real write surface
-- with the smallest schema change, no new service-role usage in request paths.
--   1. recipes   — no user-session INSERT or UPDATE at all (service role only).
--   2. recipes.source_url — must be null or an http(s) URL (reject javascript:…).
--   3. recipe_shares — the user session may UPDATE only the columns the app
--      writes with it (status, recipe_id, read_at, cleared_at, error_message);
--      shared_url (and every other column) becomes non-user-writable.
--
-- Deploy order (owner-gated): apply THIS migration, THEN deploy the app build
-- that gates „Ponów". The migration is safe to apply before the deploy — the
-- app already never updates recipes with a user session, and the recipe_shares
-- column grant still covers every column the current app writes with it.
--
-- Idempotent: drop policy if exists / revoke / guarded add constraint / column
-- grant (re-granting the same columns is a no-op).

-- ── recipes: writes are service-role only ───────────────────────────────────
-- Supabase's default privileges granted ALL on this table to authenticated;
-- take back INSERT and UPDATE (SELECT and DELETE stay — owner select + the
-- public_recipes view read, and recipes_owner_delete for the delete route).
revoke insert, update on public.recipes from authenticated;

-- Drop the two owner-write policies: with the grant gone they are already
-- inert, and leaving them would misleadingly suggest a user write path exists.
drop policy if exists recipes_owner_insert on public.recipes;
drop policy if exists recipes_owner_update on public.recipes;

-- source_url must be a real web link (or absent, for "from a cookbook"); a
-- javascript:/data: URL is a stored-XSS vector and has no business here. The
-- CHECK binds every writer, the service role included. NOT VALID enforces it on
-- every new write now without scanning legacy rows (already http(s)); the owner
-- may VALIDATE later if desired.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.recipes'::regclass
      and conname = 'recipes_source_url_scheme'
  ) then
    alter table public.recipes
      add constraint recipes_source_url_scheme
      check (source_url is null or source_url ~ '^https?://')
      not valid;
  end if;
end $$;

-- ── recipe_shares: block shared_url (and everything but the app's columns) ───
-- The owner-update RLS policy (user_id = current, 20261017140000) stays; a
-- column-level UPDATE grant now decides WHICH columns the user session may set.
-- The app writes status (retry, queue-failure fallback), recipe_id + status on
-- the dedup→favourite path (intake-favorite), read_at / cleared_at
-- (notifications) and error_message. Nothing else — so shared_url can no longer
-- be rewritten, and a popular link cannot be squatted or „Oryginał" repointed.
-- Inngest keeps writing every column with the service role.
revoke update on public.recipe_shares from authenticated;
grant update (status, recipe_id, read_at, cleared_at, error_message)
  on public.recipe_shares to authenticated;

-- ── Down (manual, owner-run) ─────────────────────────────────────────────────
-- grant insert, update on public.recipes to authenticated;
-- create policy recipes_owner_insert on public.recipes for insert
--   with check (user_id = public.current_user_id() and (select public.has_full_access()));
-- create policy recipes_owner_update on public.recipes for update
--   using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
-- alter table public.recipes drop constraint if exists recipes_source_url_scheme;
-- revoke update (status, recipe_id, read_at, cleared_at, error_message) on public.recipe_shares from authenticated;
-- grant update on public.recipe_shares to authenticated;
