-- E01 multi-recipe extraction (phase 2) — several recipes from one link.
-- A blog post can hold more than one dish (a holiday menu, a breakfast set).
-- Each dish is its own row, told apart by `source_key`: its position in the
-- extracted list ("0", "1", …). A link that yields a single recipe keeps
-- source_key null, so every existing row and every single-recipe link behaves
-- as before: one row per link, enforced by the null-key indexes below.
--
-- The two unique indexes move from (source_url) and (source_fingerprint) to
-- their key-aware pairs. Postgres treats nulls as distinct in a unique index,
-- so each pair is split by a partial predicate: null-key rows keep the old
-- one-row-per-value rule, keyed rows are unique per (value, key).
--
-- Existing rows all have source_key null, so the null-key indexes cover the
-- same rows the old ones did. The old index names are reused for the null-key
-- indexes, so the intake's existing unique-violation matching keeps working
-- during the deploy gap.
--
-- Rollback (only while no keyed rows exist):
--   delete from public.recipes where source_key is not null;  -- review first!
--   drop index public.recipes_source_url_key_uniq;
--   drop index public.recipes_source_fingerprint_key_uniq;
--   drop index public.recipes_source_url_uniq;
--   drop index public.recipes_source_fingerprint_uniq;
--   create unique index recipes_source_url_uniq
--     on public.recipes (source_url) where source_url is not null;
--   create unique index recipes_source_fingerprint_uniq
--     on public.recipes (source_fingerprint) where source_fingerprint is not null;
--   alter table public.recipes drop column source_key;

alter table public.recipes add column if not exists source_key text;

-- Before the new indexes: a keyed row may only be added once the old one-per-link
-- rule is gone, so drop, then recreate under the same name with the null-key
-- predicate. The whole file runs in one transaction, so a failure rolls back.
drop index if exists public.recipes_source_url_uniq;
create unique index if not exists recipes_source_url_uniq
  on public.recipes (source_url)
  where source_url is not null and source_key is null;
create unique index if not exists recipes_source_url_key_uniq
  on public.recipes (source_url, source_key)
  where source_url is not null and source_key is not null;

drop index if exists public.recipes_source_fingerprint_uniq;
create unique index if not exists recipes_source_fingerprint_uniq
  on public.recipes (source_fingerprint)
  where source_fingerprint is not null and source_key is null;
create unique index if not exists recipes_source_fingerprint_key_uniq
  on public.recipes (source_fingerprint, source_key)
  where source_fingerprint is not null and source_key is not null;
