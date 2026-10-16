-- Who published the recipe at its source: the Facebook profile or Page that
-- posted it, or the YouTube channel. Shown before the platform in the source
-- label ("Kulinarna Wiola · Facebook"). NULL for blogs, which are named by
-- their domain, and for recipes saved before this column existed.
alter table public.recipes
  add column source_author text;
