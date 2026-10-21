-- Performance (issue #444) — the category page used to read every matching
-- row's `tags` from public_recipes on each load, only to compute the per-tag
-- filter counters and the category total in JS (a scan that grows with the
-- category). This RPC does the aggregation in Postgres and returns one row per
-- present tag instead of N full rows.
--
--   category_tag_facets(p_category, p_selected)  among the recipes in
--       p_category that match ALL of p_selected (AND logic, `tags @> selected`,
--       empty = no filter), the count of recipes carrying each tag — the exact
--       `counts` map tagFacets() built client-side (tags deduped per row).
--
-- SECURITY INVOKER, like search_recipes: it reads the guest-safe public_recipes
-- view (not the owner-only `recipes` table), so anon and authenticated both get
-- the full public catalog through the view's own privileges. `stable`: a read,
-- safe to call per request. The GIN idx_recipes_tags and recipes_category_created_idx
-- back the category filter + the `@>` test.
--
-- Additive and idempotent (create or replace); no table, view, column, RLS or
-- data change. Apply BEFORE the app build that calls it — until then the page
-- keeps the old full-tags read (the implementation PR ships both together, and
-- the page degrades to no chips if the RPC is missing). Apply via the Management
-- API like .ai/runs/2026-10-21-recipe-category-indexes/APPLY.md.
-- Rehearsal: .ai/qa/issue-444-rehearse-category-tag-facets.sql (rolled back).
--
-- Rollback:
--   drop function if exists public.category_tag_facets(public.recipe_category, text[]);

create or replace function public.category_tag_facets(
  p_category public.recipe_category,
  p_selected text[] default '{}'
)
returns table (tag text, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.tag, count(*)::bigint
  from public.public_recipes v
  -- Distinct per row: a tag listed twice on one recipe must count once, mirroring
  -- the client-side `new Set(row.tags)`.
  cross join lateral (select distinct x from unnest(v.tags) as x) t(tag)
  where v.category = p_category
    and v.tags @> coalesce(p_selected, '{}'::text[])
  group by t.tag
$$;

comment on function public.category_tag_facets(public.recipe_category, text[]) is
  'Per-tag recipe counts for the category page filter (issue #444): among recipes in '
  'p_category matching ALL of p_selected (AND, empty = no filter), how many carry each tag. '
  'Reads the guest-safe public_recipes view.';

revoke all on function public.category_tag_facets(public.recipe_category, text[]) from public;
grant execute on function public.category_tag_facets(public.recipe_category, text[]) to anon, authenticated;
