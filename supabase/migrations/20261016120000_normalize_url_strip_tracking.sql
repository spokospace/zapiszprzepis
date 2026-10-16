-- Drop click/campaign tracking params in normalize_url().
--
-- Keeps parity with src/lib/url-normalize.ts (TRACKING_PARAM_RE): the same page
-- shared with an ?fbclid=… tail from Facebook, or utm_* from a newsletter, is
-- one recipe, so the params are dropped from the dedup key and the stored URL.
-- Params that name content (?p=, ?page_id=, ?paged=) are left alone.
--
-- Runtime writes are already normalized by the TS function; this function only
-- backs the one-off re-key. The data re-key itself is run from
-- scripts/backfill-source-urls.ts (--apply), NOT here: it resolves the
-- collisions a bare UPDATE would hit when two rows (one with the tracking tail,
-- one without) collapse onto the same (user_id, source_url) unique key.
--
-- Ordering: run that backfill promptly after deploy. Until it runs, existing
-- rows keep their tracking tails, so a fresh share of the same URL (now stored
-- without the tail) will not match the old row and is saved as a duplicate.

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
  pair text;
  kept text[] := '{}';
  param_key text;
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

  -- Drop tracking params, keep the rest in order (mirrors TRACKING_PARAM_RE).
  if query_part <> '' then
    foreach pair in array string_to_array(substring(query_part from 2), '&') loop
      param_key := split_part(pair, '=', 1);
      if pair <> '' and param_key !~* '^(fbclid|_aem|gclid|dclid|gclsrc|gbraid|wbraid|msclkid|yclid|igshid|igsh|mc_cid|mc_eid|utm_[a-z_]+)$' then
        kept := array_append(kept, pair);
      end if;
    end loop;
    if array_length(kept, 1) is null then
      query_part := '';
    else
      query_part := '?' || array_to_string(kept, '&');
    end if;
  end if;

  return scheme || host_part || path_part || query_part;
end;
$$;

comment on function public.normalize_url(text) is
  'URL normalizer mirroring src/lib/url-normalize.ts: lowercase host, strip trailing slash on non-root paths, drop fragment, drop click/campaign tracking params.';
