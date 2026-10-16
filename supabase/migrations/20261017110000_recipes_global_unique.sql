-- E01-S03a (Phase 3) — one recipe per link, enforced by the database.
-- Uniqueness of the source link and of the author-text fingerprint becomes
-- site-wide instead of per user. Apply right after the one-off collapse
-- (scripts/collapse-duplicate-recipes.ts --apply): while any duplicate remains
-- the first create fails and nothing changes.
--
-- The intake code already handles both index generations (run-extract-recipe.ts
-- URL_KEY / GLOBAL_URL_KEY), so it needs no deploy alongside this.
--
-- Known gap (spec R-M1): a unique index cannot tell two keys of one Facebook
-- group post apart; intake (matchKey) covers that, this is the backstop for
-- exact-link races. (user_id, slug) stays as it is (E01-S03b).
--
-- Rollback (needed before restore_recipe_merge):
--   create unique index recipes_user_source_url_uniq
--     on public.recipes (user_id, source_url) where source_url is not null;
--   create unique index recipes_user_source_fingerprint_uniq
--     on public.recipes (user_id, source_fingerprint) where source_fingerprint is not null;
--   drop index public.recipes_source_url_uniq;
--   drop index public.recipes_source_fingerprint_uniq;

-- The global indexes first, so a leftover duplicate fails before anything is dropped.
create unique index recipes_source_url_uniq
  on public.recipes (source_url)
  where source_url is not null;

create unique index recipes_source_fingerprint_uniq
  on public.recipes (source_fingerprint)
  where source_fingerprint is not null;

drop index public.recipes_user_source_url_uniq;
drop index public.recipes_user_source_fingerprint_uniq;
