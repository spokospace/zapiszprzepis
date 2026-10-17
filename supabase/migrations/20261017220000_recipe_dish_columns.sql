-- E01-S21b (#298) — dish columns on recipes, for the backfill of the existing
-- recipes ahead of S21 "versions of the same dish" (#296, spec PR #297).
--
--   recipes.dish                grouping key: normalized Polish dish name, lowercase,
--                               nominative ("sernik", "sernik na zimno"). Null means
--                               unknown or not a single dish.
--   recipes.dish_accusative     the same name in the accusative, for "Inne przepisy na
--                               szarlotkę". Null makes the UI fall back to case-free wording.
--   recipes.variant_note        2–6-word sentence-case phrase saying what sets this
--                               version apart from the dish's other versions.
--   recipes.dish_classified_at  when the classification last succeeded, even if it gave
--                               null. Null means never classified: the backfill and the
--                               future runtime gap-fill only touch such rows.
--
-- Schema only. The values are written straight to the database by the owner-reviewed
-- #298 backfill, never from the repo. The public_recipes view, the dish_versions /
-- dish_vocabulary RPCs, the index, the UI and the extraction belong to S21 (#296).
-- No consumer reads or writes these columns yet, so applying this changes nothing for
-- the live build.
--
-- Additive and idempotent: `add column if not exists`, and each check constraint is
-- added only when missing. The checks are the ones the S21 spec defines for the
-- columns, so the backfill cannot store a value the app's validators would reject.
--
-- Rollback: `alter table public.recipes drop column if exists variant_note,
-- drop column if exists dish_accusative, drop column if exists dish,
-- drop column if exists dish_classified_at;` (the checks go with their columns).
-- Rehearsal: .ai/qa/s21b-rehearse-recipe-dish-columns.sql (rolled back).

alter table public.recipes
  add column if not exists dish text,
  add column if not exists dish_accusative text,
  add column if not exists variant_note text,
  add column if not exists dish_classified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipes_dish_format' and conrelid = 'public.recipes'::regclass
  ) then
    alter table public.recipes
      add constraint recipes_dish_format check (
        dish is null
        or (dish = btrim(dish) and char_length(dish) between 3 and 60 and dish !~ '[A-ZĄĆĘŁŃÓŚŹŻ]')
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipes_dish_accusative_format' and conrelid = 'public.recipes'::regclass
  ) then
    alter table public.recipes
      add constraint recipes_dish_accusative_format check (
        dish_accusative is null
        or (dish is not null and char_length(dish_accusative) between 3 and 80)
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipes_variant_note_length' and conrelid = 'public.recipes'::regclass
  ) then
    alter table public.recipes
      add constraint recipes_variant_note_length check (
        variant_note is null or char_length(variant_note) between 3 and 60
      );
  end if;
end
$$;

comment on column public.recipes.dish is
  'Dish grouping key: normalized Polish name, lowercase, nominative. Null = unknown / not a single dish.';
comment on column public.recipes.dish_accusative is
  'The dish name in the accusative ("na szarlotkę"). Null = UI uses case-free wording.';
comment on column public.recipes.variant_note is
  'Short sentence-case note on what sets this version apart from the same dish''s other versions.';
comment on column public.recipes.dish_classified_at is
  'When the dish classification last succeeded (even if it gave null). Null = never classified.';
