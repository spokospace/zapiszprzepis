-- E01 follow-up to S02 — make public recipe reads FAIL CLOSED.
-- S02's recipes_public_read (using true) made every SELECT on recipes return every
-- user's rows, so any query that forgot a user_id filter leaked across users (the
-- delete route and the failed-shares bell both did, and were patched by hand).
-- Restore owner-only RLS on the table and serve guest reads through views whose
-- column lists ARE the boundary. A forgotten filter on `recipes` now returns only
-- the caller's own rows.
--
-- Rollback: drop both views and the index, then re-create recipes_public_read
-- (20261016170000_recipes_public_read.sql).

drop policy if exists recipes_public_read on public.recipes;

-- Guest-safe projection of a recipe plus the author's public display name.
-- Left out on purpose: user_id, image_urls (the gallery is login-only — decision Q3),
-- source_fingerprint, extracted_at, updated_at.
-- security_invoker = false: the view runs as its owner, which bypasses the
-- owner-only RLS on recipes. That is the intent — the explicit column list, not RLS,
-- decides what a guest sees. (The Supabase "security definer view" advisor will flag
-- this; it is deliberate.)
create view public.public_recipes
with (security_invoker = false)
as
select
  r.id,
  r.slug,
  r.title,
  r.description,
  r.image_url,
  r.category,
  r.tags,
  r.prep_time_minutes,
  r.cook_time_minutes,
  r.total_time_minutes,
  r.ingredients,
  r.steps,
  r.source_type,
  r.source_url,
  r.youtube_id,
  r.created_at,
  p.display_name as author_name
from public.recipes r
left join public.profiles p on p.id = r.user_id;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery. Read-only.';

-- Supabase's default privileges grant ALL on new public relations to anon and
-- authenticated. A view running as its owner must be strictly read-only.
revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

-- The gallery, for signed-in visitors only (decision Q3: a login perk).
create view public.recipe_gallery_images
with (security_invoker = false)
as
select r.id, r.image_urls
from public.recipes r;

comment on view public.recipe_gallery_images is
  'Recipe galleries for signed-in visitors (E01, Q3). Read-only; no anon access.';

-- A single-table view is auto-updatable and this one runs as its owner: without the
-- revoke, a signed-in user could UPDATE any recipe's image_urls through it, past RLS.
revoke all on public.recipe_gallery_images from anon, authenticated;
grant select on public.recipe_gallery_images to authenticated;

-- Guest lookups filter on slug alone, which idx_recipes_user_slug (user_id, slug)
-- cannot serve.
create index if not exists idx_recipes_slug on public.recipes (slug);
