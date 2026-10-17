-- E01-S03b (Migration B) — slug uniqueness becomes site-wide instead of
-- per user. Apply right after Migration A (and E01-S03a's collapse): while any
-- duplicate slug remains the unique index creation fails and nothing is dropped,
-- so the migration cannot leave the table half-changed.
--
-- The intake code already matches both key generations (run-extract-recipe.ts
-- SLUG_KEY / GLOBAL_SLUG_KEY), so it needs no deploy alongside this.
--
-- The non-unique idx_recipes_user_slug (user_id, slug) is kept — it still serves
-- the owner's "where user_id = ? and slug = ?" lookups (refresh, delete, dedup).
-- The new recipes_slug_uniq covers the guest "where slug = ?" page read.
--
-- Rollback (down):
--   alter table public.recipes
--     add constraint recipes_user_id_slug_key unique (user_id, slug);
--   drop index public.recipes_slug_uniq;
-- Then, to undo Migration A's renames, replay recipe_slug_rename_log in reverse
-- (see that migration's header). NOTE: E01-S03a's restore_recipe_merge checks
-- slugs per user; before running it after this migration, drop recipes_slug_uniq
-- here too, or a restored row may hit the global slug index.

-- The global unique index first, so a leftover duplicate slug fails here —
-- before the per-user constraint is dropped.
create unique index recipes_slug_uniq on public.recipes (slug);

alter table public.recipes drop constraint recipes_user_id_slug_key;
