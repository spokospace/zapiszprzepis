-- E01-S23 — gendered wording in public texts ("Dodała / Dodał {nazwa}").
-- Issue #290; owner decision: .ai/analysis/2026-10-17-design-gap-audit.md, "Do decyzji" pt 1.
--
-- Guests get ONLY a grammatical form, never the raw gender:
--   'f'  → feminine verb forms (Dodała, nie dodała)
--   'm'  → masculine verb forms (Dodał, nie dodał)
--   null → not chosen yet / no profile: the app uses neutral wording
--
-- 1. public_recipes.author_gender_form — appended to the guest-safe view. The
--    view runs as its owner (security_invoker = false), exactly like the
--    existing profiles join for author_name, so it can read profiles_private
--    without any grant to anon/authenticated. Only the derived form leaves the
--    view; gender, gender_set_at and first_name do not.
-- 2. public.profile_gender_form(username) — the same form for /u/{username},
--    which also needs it for a profile with no recipes (empty state).
--    SECURITY DEFINER, returns one text value, nothing else.
--
-- profiles_private itself is unchanged: owner-only RLS, no anon grant (S12).
--
-- Additive and idempotent: create-or-replace can only APPEND view columns, so
-- every existing column keeps its name and position (select('*') consumers are
-- unaffected). The app reads the column/function as optional and falls back to
-- neutral wording, so it is safe to deploy before this migration.
--
-- Ordering with 20261017200000_recipe_servings.sql (#293), which also appends a
-- column (servings) to this view: apply that one FIRST, in version order. This
-- migration keeps `servings` (before author_gender_form) whenever recipes already
-- has the column, so it works with or without #293 applied; applying #293 AFTER
-- this one fails loudly (create-or-replace cannot drop author_gender_form).
--
-- Rollback: re-run the view definition from the latest earlier migration that
-- defines it (20261017200000_recipe_servings.sql if applied, else
-- 20261017150000_public_recipes_author_username_gallery_count.sql) as
-- drop view + create without author_gender_form, and
--   drop function if exists public.profile_gender_form(text);
-- The app degrades to neutral wording.
-- Rehearsal: .ai/qa/s23-rehearse-author-gender-form.sql (rolled back).

do $view$
declare
  -- r.servings stays in position 23 when #293 is applied, so create-or-replace
  -- only appends author_gender_form.
  servings_col text := case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'servings'
    ) then 'r.servings,'
    else ''
  end;
begin
  execute format($sql$
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
  case pp.gender when 'female' then 'f' when 'male' then 'm' end as author_gender_form
from public.recipes r
left join public.profiles p on p.id = r.user_id
left join public.profiles_private pp on pp.id = r.user_id
$sql$, servings_col);
end
$view$;

comment on view public.public_recipes is
  'Guest-safe read of every recipe (E01). No user_id, no gallery URLs (count only), '
  'author gender only as a grammatical form (f/m/null). Read-only.';

revoke all on public.public_recipes from anon, authenticated;
grant select on public.public_recipes to anon, authenticated;

create or replace function public.profile_gender_form(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case pp.gender when 'female' then 'f' when 'male' then 'm' end
  from public.profiles p
  join public.profiles_private pp on pp.id = p.id
  where p.username = p_username
$$;

comment on function public.profile_gender_form(text) is
  'Grammatical form (f/m/null) for public wording on /u/{username} (E01-S23). Never the raw gender.';

revoke all on function public.profile_gender_form(text) from public;
grant execute on function public.profile_gender_form(text) to anon, authenticated;
