-- Per-recipe SEO meta description: one plain sentence describing the dish, for
-- <meta name="description"> and Open Graph on the recipe page. Distinct from
-- recipes.description, which is a 2-5 word distinguishing note shown as the
-- subtitle — this is a full sentence (~150-160 chars, Google's display budget)
-- and may repeat the title. Written by the same labelling LLM pass that sets
-- the note and tags (gpt-4.1), so new recipes get it at save time and the
-- backfill fills existing ones.
--
-- Rollback: drop column recipes.meta_description (cascades to the view column),
-- then recreate public_recipes without it.

alter table public.recipes
  add column if not exists meta_description text;

comment on column public.recipes.meta_description is
  'SEO meta description: one sentence (~150-160 chars) describing the dish. '
  'Distinct from description (the short distinguishing note). May be null.';

-- Re-add the column to the guest-safe view. A new column can only be appended
-- at the end with create-or-replace, so meta_description follows author_name.
-- Grants and the security_invoker setting carry over, but we re-state them to
-- keep this migration self-describing.
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
  r.meta_description
from public.recipes r
left join public.profiles p on p.id = r.user_id;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery. Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;
