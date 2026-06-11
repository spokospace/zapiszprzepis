-- Recipe time fields (schema.org Recipe vocabulary)
-- prep_time_minutes: active preparation time
-- cook_time_minutes: cooking/baking time
-- total_time_minutes: total time including passive periods (marinating, resting, cooling)
-- All nullable — AI may not always find the data; render hides empty fields.

alter table public.recipes
  add column prep_time_minutes int,
  add column cook_time_minutes int,
  add column total_time_minutes int;

comment on column public.recipes.prep_time_minutes is
  'Active preparation time in minutes (cutting, mixing). Nullable — set by AI extraction.';

comment on column public.recipes.cook_time_minutes is
  'Cooking/baking time in minutes. Nullable — set by AI extraction.';

comment on column public.recipes.total_time_minutes is
  'Total time including passive periods (marinating, resting, cooling). May exceed prep + cook. Nullable — set by AI extraction.';
