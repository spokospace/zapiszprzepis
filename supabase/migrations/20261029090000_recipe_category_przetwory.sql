-- Add the "przetwory" recipe category (home preserves: jams, pickles, ketchups,
-- chutneys and marinades put up for winter). These used to be coerced into
-- "inne"; a dedicated category empties that junk drawer and gives a coherent,
-- seasonal browse intent. Appended to the enum — display order lives in
-- RECIPE_CATEGORIES (src/lib/recipe-categories.ts), not the enum's sort order.
--
-- Idempotent: already applied to prod via the Management API (unrecorded in
-- schema_migrations), so IF NOT EXISTS lets a later `supabase db push` re-run
-- it safely.
alter type recipe_category add value if not exists 'przetwory';
