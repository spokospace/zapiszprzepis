-- Recipe times the extractor estimated from its own knowledge of the dish,
-- because the source gave none. The detail page marks them with "≈". Existing
-- rows stay false: there is no telling them apart retroactively, and a wrong
-- "≈" on a time the source did state is worse than a missing one.
alter table public.recipes
  add column times_estimated boolean not null default false;

comment on column public.recipes.times_estimated is
  'True when prep/cook/total times were estimated by the extractor from general knowledge of the dish rather than stated in (or derivable from) the source.';
