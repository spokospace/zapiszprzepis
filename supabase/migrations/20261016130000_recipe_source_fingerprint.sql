-- Recipe source fingerprint: SHA-256 of the author's own text (a Facebook
-- caption, a Blogger post) reduced to its letters and digits. A Page that
-- publishes one recipe as two posts gives two URLs but one fingerprint, so the
-- repost is caught before the LLM runs. NULL when the text came from a
-- rendered page, which differs between scrapes.
alter table public.recipes
  add column source_fingerprint text;

-- At most one recipe per (user, source text); also settles two shares of one
-- repost racing through the pipeline.
create unique index recipes_user_source_fingerprint_uniq
  on public.recipes (user_id, source_fingerprint)
  where source_fingerprint is not null;
