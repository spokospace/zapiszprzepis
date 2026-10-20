-- E02 — guard the public read views' allowlist boundary (issue #403).
--
-- public.public_recipes and public.recipe_gallery_images are deliberately
-- SECURITY DEFINER (security_invoker = false, 20261016180000): recipes stays
-- owner-only RLS so a forgotten user_id filter fails closed, and the public
-- catalog is read through these views whose EXPLICIT COLUMN ALLOWLIST is the
-- boundary. The Supabase advisor flags this as "Security Definer View"; the
-- owner reviewed it (issue #403) and decided to KEEP the pattern and harden it
-- here rather than re-architect to invoker views (which would need a permissive
-- SELECT policy on recipes, re-opening the fail-open surface S02 already hit).
--
-- The one real weakness of the pattern is that the allowlist is the ONLY
-- boundary: a future `create or replace view` that silently added user_id or
-- image_urls would leak it to anon with no RLS backstop. A static SQL grep
-- cannot catch this — the view legitimately *references* user_id (join) and
-- image_urls (the gallery_count = cardinality(image_urls) expression) without
-- *exposing* them — so the guard must read the view's real OUTPUT columns from
-- the catalog. This is the same information_schema idiom the column-order-drift
-- guard in 20261020120000 already uses.
--
-- This adds a reusable boundary assertion and runs it now. It is read-only
-- (reads catalogs, raises on violation), changes no rows and no behaviour, and
-- is idempotent. Repeatable use: any future migration that create-or-replaces
-- either view should end with `select public.assert_public_view_boundary();`.
--
-- Note (not in this migration — owner actions): (1) mark both findings as
-- acknowledged in the Supabase advisor; (2) apply this migration to production
-- via the Management API, per the repo convention.
--
-- Rollback: drop function public.assert_public_view_boundary();

create or replace function public.assert_public_view_boundary()
returns void
language plpgsql
set search_path = ''
as $fn$
declare
  cols text[];
begin
  -- public_recipes output columns must exclude owner identity and gallery URLs.
  select array_agg(column_name::text) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'public_recipes';

  if cols is null then
    raise exception 'assert_public_view_boundary: view public.public_recipes is missing';
  end if;
  if 'user_id' = any (cols) then
    raise exception 'assert_public_view_boundary: public_recipes exposes user_id (forbidden); columns: %', cols;
  end if;
  if 'image_urls' = any (cols) then
    raise exception 'assert_public_view_boundary: public_recipes exposes image_urls (forbidden); columns: %', cols;
  end if;

  -- recipe_gallery_images is a signed-in perk (decision Q3): never anon-readable.
  if has_table_privilege('anon', 'public.recipe_gallery_images', 'SELECT') then
    raise exception 'assert_public_view_boundary: recipe_gallery_images is SELECT-able by anon (forbidden)';
  end if;

  -- Positive read contract: the catalog view stays anon-readable, the gallery
  -- stays readable by signed-in users.
  if not has_table_privilege('anon', 'public.public_recipes', 'SELECT') then
    raise exception 'assert_public_view_boundary: public_recipes is not SELECT-able by anon (public read contract broken)';
  end if;
  if not has_table_privilege('authenticated', 'public.recipe_gallery_images', 'SELECT') then
    raise exception 'assert_public_view_boundary: recipe_gallery_images is not SELECT-able by authenticated';
  end if;

  -- Both views are read-only to request-facing roles. recipe_gallery_images is a
  -- single-table auto-updatable view, so an UPDATE grant would let a signed-in
  -- user rewrite image_urls past RLS (the exact risk the 20261016180000 revoke
  -- closes); assert it stays closed.
  if has_table_privilege('authenticated', 'public.recipe_gallery_images', 'UPDATE') then
    raise exception 'assert_public_view_boundary: recipe_gallery_images is UPDATE-able by authenticated (forbidden)';
  end if;
  if has_table_privilege('authenticated', 'public.public_recipes', 'UPDATE') then
    raise exception 'assert_public_view_boundary: public_recipes is UPDATE-able by authenticated (forbidden)';
  end if;
end;
$fn$;

comment on function public.assert_public_view_boundary() is
  'Guard for the SECURITY DEFINER public read views (issue #403). Raises if '
  'public_recipes exposes user_id/image_urls, if recipe_gallery_images is '
  'anon-readable or authenticated-writable, if public_recipes is writable, or if '
  'the anon/authenticated read contract is broken. Re-run after any create or '
  'replace of these views: select public.assert_public_view_boundary();';

-- Fail loudly at apply time if the boundary is already broken (it is not, on the
-- current schema).
select public.assert_public_view_boundary();
