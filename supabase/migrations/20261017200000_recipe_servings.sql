-- E01-S07b follow-up — servings, for "Składniki · na N porcji" on the recipe page
-- (design handoff C3, item 8).
--
--   recipes.servings         how many servings the SOURCE states (JSON-LD recipeYield,
--                            "na 4 porcje", "dla 6 osób"). Null when it states none:
--                            the extraction never guesses.
--   public_recipes.servings  the same column on the guest-safe view, appended last.
--
-- Additive and idempotent: `add column if not exists`, the check constraint is
-- added only when missing, and create-or-replace can only APPEND view columns, so
-- every existing column keeps its name and position and select('*') consumers are
-- unaffected.
--
-- Coexists with 20261017210000_author_gender_form.sql (E01-S23, PR #291), which
-- appends author_gender_form to the same view. Postgres matches view columns by
-- POSITION, so each migration keeps the other's column. Apply order, as the
-- versions sort: THIS one first (servings at position 23), then S23, which keeps
-- r.servings and appends author_gender_form after it. Either order still works:
-- run after S23, this one keeps author_gender_form and appends servings last.
-- Once the view has servings (applied, or re-run after S23 reordered nothing),
-- the view is left as it is, so a re-run never moves a column.
--
-- Ordering vs the app: apply BEFORE deploying the app build that writes
-- `servings` — the extraction inserts the column, and an insert naming a missing
-- column fails. The live build reads neither the column nor the extra view
-- column, so applying this first changes nothing for it.
--
-- Rollback: drop view public.public_recipes; re-create it from the newest earlier
-- definition without servings (20261017150000, or S23's with no servings) plus its
-- grants,
-- then `alter table public.recipes drop column servings`.
-- Rehearsal: .ai/qa/s07b-rehearse-recipe-servings.sql (rolled back).

alter table public.recipes add column if not exists servings smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipes_servings_range' and conrelid = 'public.recipes'::regclass
  ) then
    alter table public.recipes
      add constraint recipes_servings_range check (servings between 1 and 99);
  end if;
end
$$;

comment on column public.recipes.servings is
  'Servings the source states (1–99); null when it states none. Never estimated.';

do $$
declare
  has_gender_form boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_recipes' and column_name = 'author_gender_form'
  );
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_recipes' and column_name = 'servings'
  ) then
    return;
  end if;
  execute format($view$
    create or replace view public.public_recipes
    with (security_invoker = false)
    as
    select
      r.id,
      r.slug,
      r.title,
      r.description,
      r.image_url,
      r.category,
      r.tags,
      r.prep_time_minutes,
      r.cook_time_minutes,
      r.total_time_minutes,
      r.ingredients,
      r.steps,
      r.source_type,
      r.source_url,
      r.source_author,
      r.times_estimated,
      r.youtube_id,
      r.created_at,
      p.display_name as author_name,
      r.meta_description,
      p.username as author_username,
      coalesce(cardinality(r.image_urls), 0) as gallery_count,
      %s
      r.servings
    from public.recipes r
    left join public.profiles p on p.id = r.user_id
    %s
  $view$,
    case when has_gender_form
      then $c$case pp.gender when 'female' then 'f' when 'male' then 'm' end as author_gender_form,$c$
      else '' end,
    case when has_gender_form
      then 'left join public.profiles_private pp on pp.id = r.user_id'
      else '' end);
end
$$;

-- The view comment is left as it is (create-or-replace keeps it): S23 words it
-- for author_gender_form, and servings needs no mention.

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;
