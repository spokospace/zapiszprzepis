-- Category SEO descriptions: one editable sentence per recipe category.
-- Spec: .ai/specs/2026-10-20-category-meta-description.md
--
-- /przepisy/{kategoria} emitted no <meta name="description"> — all 12 category
-- pages inherited the generic root-layout sentence. The copy is marketing text
-- the owner tunes repeatedly, so it lives as data (edited in the Supabase
-- dashboard, no deploy) rather than a typed Record in the repo.
--
-- generateMetadata reads this table as the anonymous SSR client (crawlers are
-- anonymous), so RLS grants a public SELECT. There is no write policy: edits go
-- through the service role / dashboard, like other owner-only data. The loader
-- (src/lib/category-descriptions.ts) falls back to a templated sentence on a
-- missing row or a read error, so the app is safe to deploy before this runs.
--
-- The char_length 1..160 check enforces the SERP length rule at the data layer:
-- a too-long paste is rejected on write instead of silently truncated by Google.
--
-- Idempotent: safe to re-run. The rows themselves are content, not schema: they
-- are written straight to the database (the repo is public), never committed here.
--
-- Rollback (drops the editable copy; the app degrades to the template):
--   drop table if exists public.category_descriptions;

create table if not exists public.category_descriptions (
  category public.recipe_category primary key,
  meta_description text not null check (char_length(meta_description) between 1 and 160),
  updated_at timestamptz not null default now()
);

comment on table public.category_descriptions is
  'Per-category SEO meta description (one row per recipe_category). Public read; '
  'owner-only writes via the dashboard. Read in generateMetadata for /przepisy/{kategoria}.';

alter table public.category_descriptions enable row level security;

-- SEO copy is public; the category route reads it with the guest SSR client.
drop policy if exists category_descriptions_public_read on public.category_descriptions;
create policy category_descriptions_public_read
  on public.category_descriptions
  for select
  to anon, authenticated
  using (true);
