-- Recipe writes through the API failed since 20261106100000 (#722): every insert, update or
-- delete on public.recipes (and a display name / username change on public.profiles) fires
-- bump_recipe_content_version(), whose UPDATE of the one-row recipe_files_state had no WHERE.
-- PostgREST sessions preload pg_safeupdate (authenticator: session_preload_libraries =
-- supautils, safeupdate), which rejects an UPDATE without WHERE with SQLSTATE 21000
-- ("UPDATE requires a WHERE clause"). So imports failed ("Database insert failed"), staff
-- recipe edits returned 400, and content_version never moved, so the recipe files were never
-- refreshed. Direct SQL (Management API, migrations) does not load safeupdate, which is why
-- the migration's own checks passed.
--
-- Fix: the same function with `where id` (the table's only row has the primary key true).
-- Any UPDATE or DELETE in a function that the API can reach needs a WHERE clause.
--
-- Order: independent of any deploy. Applied through the Management API, then checked with a
-- staff write through PostgREST (recipes_set_meta_title on the MCP).
--
-- Idempotent: safe to re-run.
--
-- Rollback (manual): re-run the bump_recipe_content_version block of
-- 20261106100000_recipe_files_refresh.sql (restores the bug).

create or replace function public.bump_recipe_content_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- recipes_updated_at_trigger touches updated_at on every update, also one that changes nothing.
  if tg_op = 'UPDATE' and to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then
    return null;
  end if;
  -- WHERE is required: PostgREST sessions run pg_safeupdate (see the header).
  update public.recipe_files_state set content_version = content_version + 1 where id;
  return null;
end;
$$;

revoke all on function public.bump_recipe_content_version() from public, anon, authenticated;
