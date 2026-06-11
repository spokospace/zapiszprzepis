-- Recipe URL deduplication
-- Normalizes source_url/shared_url, backfills existing rows, adds unique partial index.
--
-- The PL/pgSQL normalize_url() must produce the SAME output as src/lib/url-normalize.ts
-- (lowercase host, strip trailing slash on non-root paths, drop fragment, preserve query).
-- Keep both in sync if either changes.

create or replace function public.normalize_url(raw text)
returns text
language plpgsql
immutable
strict
as $$
declare
  no_frag text;
  scheme text;
  after_scheme text;
  host_part text;
  after_host text;
  path_part text;
  query_part text;
  query_pos int;
begin
  -- Strip fragment
  no_frag := split_part(raw, '#', 1);

  -- Extract scheme:// (lowercase). If absent, return input unchanged — caller may
  -- have stored a non-URL string at some point and we don't want migration to crash.
  scheme := lower(substring(no_frag from '^[a-zA-Z][a-zA-Z0-9+.-]*://'));
  if scheme is null then
    return raw;
  end if;

  after_scheme := substring(no_frag from length(scheme) + 1);

  -- Host = everything up to first '/' or '?' (preserves port if present)
  host_part := lower(substring(after_scheme from '^[^/?]*'));
  after_host := substring(after_scheme from length(host_part) + 1);

  -- Split path from query
  query_pos := position('?' in after_host);
  if query_pos > 0 then
    path_part := substring(after_host from 1 for query_pos - 1);
    query_part := substring(after_host from query_pos);
  else
    path_part := after_host;
    query_part := '';
  end if;

  -- WHATWG URL parser always emits '/' for the root path. Mirror that so the
  -- TS and SQL normalizers agree on `https://example.com` → `https://example.com/`.
  if path_part = '' then
    path_part := '/';
  end if;

  -- Strip trailing slash from non-root paths
  if length(path_part) > 1 and right(path_part, 1) = '/' then
    path_part := substring(path_part from 1 for length(path_part) - 1);
  end if;

  return scheme || host_part || path_part || query_part;
end;
$$;

comment on function public.normalize_url(text) is
  'URL normalizer mirroring src/lib/url-normalize.ts: lowercase host, strip trailing slash on non-root paths, drop fragment.';

-- Backfill normalized URLs on existing rows. Idempotent: re-running normalize_url
-- on already-normalized input is a no-op.
update public.recipes
   set source_url = public.normalize_url(source_url)
 where source_url is not null;

update public.recipe_shares
   set shared_url = public.normalize_url(shared_url)
 where shared_url is not null;

-- Race protection: at most one completed recipe per (user, URL). Partial so
-- NULL source_url (legacy / unknown source) doesn't block inserts.
create unique index recipes_user_source_url_uniq
  on public.recipes (user_id, source_url)
  where source_url is not null;
