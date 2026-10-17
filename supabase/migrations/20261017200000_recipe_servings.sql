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
-- Ordering: apply BEFORE deploying the app build that writes `servings` — the
-- extraction inserts the column, and an insert naming a missing column fails. The
-- live build reads neither the column nor the extra view column, so applying this
-- first changes nothing for it.
--
-- Rollback: re-run the view definition from
-- 20261017150000_public_recipes_author_username_gallery_count.sql (drop view +
-- create without servings), then `alter table public.recipes drop column servings`.

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
  r.servings
from public.recipes r
left join public.profiles p on p.id = r.user_id;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only). Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;
