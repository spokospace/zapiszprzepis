-- Tags: extra labels on top of the single category (occasion, pastry type,
-- leading ingredient). The allowed values live in src/lib/recipe-tags.ts —
-- a closed list the app enforces, kept out of an enum so adding a tag needs
-- no migration.
alter table public.recipes add column tags text[] not null default '{}';
create index idx_recipes_tags on public.recipes using gin (tags);

-- recipes.description was never written; it now holds the short
-- distinguishing note shown under the title ("z rowkami, na żółtkach").
comment on column public.recipes.description is
  'Short (2–5 words) note on what sets this recipe apart from similarly titled ones.';
