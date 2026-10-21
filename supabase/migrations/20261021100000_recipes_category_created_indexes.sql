-- Performance — index the two hot read paths that currently seq-scan + sort
-- public.recipes (through the public_recipes view) on every request:
--
--   1. (category, created_at desc, id desc)
--      The category listing (/przepisy/[kategoria]), its tag filter
--      (?tag=, adds `tags @> …` on top of the same category + order), and the
--      "Podobne" block on every recipe page all run
--        where category = ? [and tags …] order by created_at desc, id desc
--      With no index on category, Postgres filters the whole table and sorts
--      the match set each time; this composite serves the filter AND the sort,
--      so the listing is answered straight from the index. The GIN
--      idx_recipes_tags still covers the `tags @> …` membership test.
--
--   2. (created_at desc, id desc)
--      The home "Ostatnio dodane" feed and any global newest-first read order
--      by created_at with no user_id, which idx_recipes_user_created
--      (user_id, created_at desc) cannot serve. This global index can.
--
-- Index-only, additive and idempotent (`if not exists`): no table, column,
-- view, RLS or data change, so it is safe to apply in any order relative to a
-- deploy and safe to re-run. It touches recipes directly; public_recipes reads
-- from recipes, so the planner uses these indexes for view queries too.
--
-- Lock: a plain CREATE INDEX takes a brief ACCESS EXCLUSIVE lock on recipes.
-- At this catalog's size the build is milliseconds, so the momentary lock is
-- acceptable and keeps the statement transaction-safe for the Management API
-- query endpoint. On a large table, build each CONCURRENTLY instead — but that
-- cannot run inside a transaction block.
--
-- Rollback (down):
--   drop index if exists public.recipes_category_created_idx;
--   drop index if exists public.recipes_created_idx;

create index if not exists recipes_category_created_idx
  on public.recipes (category, created_at desc, id desc);

create index if not exists recipes_created_idx
  on public.recipes (created_at desc, id desc);
