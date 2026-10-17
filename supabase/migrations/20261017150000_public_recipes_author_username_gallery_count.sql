-- E01-S07 — recipe page: two more guest-safe columns on public_recipes.
--
--   author_username  the author's public username, for the "Dodane przez" link to
--                    /u/{username} (E01-S14). profiles is already anon-readable, so
--                    this exposes nothing new.
--   gallery_count    how many gallery photos the recipe has, for the guest teaser
--                    "Galeria N zdjęć po zalogowaniu". A count only: the URLs stay
--                    login-only in recipe_gallery_images (decision Q3).
--
-- Additive and idempotent: create-or-replace can only APPEND columns, so every
-- existing column keeps its name and position and select('*') consumers are
-- unaffected. The app reads both columns as optional, so it is safe to deploy
-- before this migration (no teaser, plain-text author until then).
--
-- Rollback: re-run the view definition from 20261016230000_recipe_meta_description.sql
-- (drop view + create without the two columns; the app degrades as above).
-- Rehearsal: .ai/qa/s07-rehearse-public-recipes-view.sql (rolled back).
-- Ordering: independent of 20261017130000 (profiles_private, E01-S12) and
-- 20261017140000 (full access gate, E01-S11): neither touches this view or the
-- columns it reads, and the view runs as its owner, so recipes RLS changes do not
-- affect it.

create or replace view public.public_recipes
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
  r.source_author,
  r.times_estimated,
  r.youtube_id,
  r.created_at,
  p.display_name as author_name,
  r.meta_description,
  p.username as author_username,
  coalesce(cardinality(r.image_urls), 0) as gallery_count
from public.recipes r
left join public.profiles p on p.id = r.user_id;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only). Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;
