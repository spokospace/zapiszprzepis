-- A new enum value cannot be used in the transaction that adds it, so moving
-- the existing cookies lives in the next migration.
alter type public.recipe_category add value if not exists 'ciasteczka' after 'desery';
