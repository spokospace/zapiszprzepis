-- Category SEO titles: one editable <title> per recipe category, mirroring the
-- meta_description column added in 20261020130000_category_descriptions.sql.
--
-- /przepisy/{kategoria} built its <title> as `{label} · Zapisz Przepis`, so every
-- category page read the same dry pattern. The title is marketing copy the owner
-- tunes like the description, so it lives as data (edited in the Supabase
-- dashboard, no deploy) rather than a typed Record in the repo.
--
-- Nullable on purpose: a row may carry a description but no custom title. The
-- loader (src/lib/category-descriptions.ts) falls back to a curated, human title
-- per category on a missing value or a read error, so the app is safe to deploy
-- before this runs and every page still gets a tailored title.
--
-- The app stores the title BASE here (no brand suffix); `· Zapisz Przepis` is
-- appended by the page for the browser tab, while Open Graph / Twitter use the
-- base alone. char_length 1..70 keeps the base within the SERP title budget.
--
-- Idempotent: safe to re-run. Column add is guarded by IF NOT EXISTS; the length
-- check is added once by name. Rows are content, written straight to the
-- database, never committed here.
--
-- Rollback (drops the editable copy; the app degrades to the curated fallback):
--   alter table public.category_descriptions
--     drop constraint if exists category_descriptions_meta_title_len,
--     drop column if exists meta_title;

alter table public.category_descriptions
  add column if not exists meta_title text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'category_descriptions_meta_title_len'
  ) then
    alter table public.category_descriptions
      add constraint category_descriptions_meta_title_len
      check (meta_title is null or char_length(meta_title) between 1 and 70);
  end if;
end $$;

comment on column public.category_descriptions.meta_title is
  'Per-category SEO <title> base (brand suffix appended by the app). Nullable; '
  'the app falls back to a curated title. Public read via the table''s SELECT policy.';
