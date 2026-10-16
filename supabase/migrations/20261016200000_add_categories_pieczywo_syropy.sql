-- Two recipe types were scattered across other categories: bread & rolls, and
-- homemade health syrups/tinctures. Give each its own category. A new enum
-- value cannot be used in the transaction that adds it, so the backfill that
-- moves existing recipes lives in the next migration.
alter type public.recipe_category add value if not exists 'pieczywo' after 'sniadania';
alter type public.recipe_category add value if not exists 'syropy' after 'napoje';
