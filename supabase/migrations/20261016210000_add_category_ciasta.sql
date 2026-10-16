-- "Desery" had grown into the largest category by mixing baked cakes with
-- non-cake sweets. Give baked cakes their own "ciasta" category. A new enum
-- value cannot be used in the transaction that adds it, so the backfill that
-- moves existing recipes lives in the next migration.
alter type public.recipe_category add value if not exists 'ciasta' after 'desery';
