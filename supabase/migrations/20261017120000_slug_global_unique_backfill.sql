-- E01-S03b (Migration A) — make recipe slugs globally unique, reversibly.
-- Each slug used by more than one row keeps the oldest row (created_at asc, then
-- id asc) on the bare slug; every later row is renamed to the lowest free
-- "{slug}-N" (N from 2) not already taken by any row. Every rename is written to
-- recipe_slug_rename_log so Migration B's down can replay it in reverse.
--
-- Idempotent: once slugs are unique the group scan finds nothing and nothing is
-- renamed or logged. Schema + data rename only, no data assertions, so it is
-- safe on `db reset` (empty table → no-op). The same rule is mirrored, and unit
-- tested, in src/lib/slug-rename.ts (buildSlugRenames).
--
-- Sequencing: run after E01-S03a's collapse so the only remaining same-slug
-- rows are recipes that genuinely differ by content but share a title.
--
-- Rollback (before Migration B, or after Migration B's down drops the global
-- index): replay the log in reverse —
--   do $$
--   declare e record;
--   begin
--     for e in select * from public.recipe_slug_rename_log order by id desc loop
--       update public.recipes set slug = e.old_slug where id = e.recipe_id and slug = e.new_slug;
--     end loop;
--   end $$;
--   -- then, if desired: drop table public.recipe_slug_rename_log;

create table if not exists public.recipe_slug_rename_log (
  id bigint generated always as identity primary key,
  recipe_id bigint not null,
  old_slug text not null,
  new_slug text not null,
  created_at timestamp with time zone not null default now()
);

comment on table public.recipe_slug_rename_log is
  'E01-S03b: slug renames that made slugs globally unique (migration A), so the change is reversible. Service-only.';

create index if not exists recipe_slug_rename_log_recipe_id_idx
  on public.recipe_slug_rename_log (recipe_id);

-- Service-only: RLS on, no policies, no grants to the API roles.
alter table public.recipe_slug_rename_log enable row level security;
revoke all on public.recipe_slug_rename_log from anon, authenticated;

do $backfill$
declare
  grp record;
  loser_id bigint;
  base_slug text;
  suffix integer;
  candidate text;
begin
  for grp in
    select slug as s from public.recipes
    group by slug having count(*) > 1
  loop
    base_slug := grp.s;
    -- The losers, oldest first; offset 1 leaves the keeper on the bare slug.
    -- The id list is fixed when the cursor opens, so renaming rows inside the
    -- loop does not disturb which rows are losers.
    for loser_id in
      select id from public.recipes
      where slug = base_slug
      order by created_at asc, id asc
      offset 1
    loop
      suffix := 2;
      candidate := base_slug || '-' || suffix;
      -- Skip any suffix already in use (including ones assigned earlier in this
      -- run, which the WHERE sees because each UPDATE below commits to the
      -- in-transaction state).
      while exists (select 1 from public.recipes where slug = candidate) loop
        suffix := suffix + 1;
        candidate := base_slug || '-' || suffix;
      end loop;
      update public.recipes set slug = candidate where id = loser_id;
      insert into public.recipe_slug_rename_log (recipe_id, old_slug, new_slug)
      values (loser_id, base_slug, candidate);
    end loop;
  end loop;
end;
$backfill$;
