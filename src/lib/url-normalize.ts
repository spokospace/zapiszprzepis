import { groupPostKeyPattern, isFacebookPostUrl, isFacebookShareUrl, isFacebookUrl, normalizeFacebookHost, toPostUrl } from './facebook'

// Click/campaign params that identify where a visitor came from, never which
// page they asked for: Facebook's fbclid and its _aem companion (the "?fbclid="
// tail a link shared from Facebook carries), ad-network click ids, and the
// utm_* / mc_* campaign set. Two shares of the same recipe differ only by these,
// so they are dropped from the dedup key and from the stored source_url. Params
// that name content (a WordPress ?p= / ?page_id=, ?paged=) are deliberately
// left alone. Facebook post-id params are kept earlier by toPostUrl.
const TRACKING_PARAM_RE =
  /^(?:fbclid|_aem|gclid|dclid|gclsrc|gbraid|wbraid|msclkid|yclid|igshid|igsh|mc_cid|mc_eid|utm_[a-z_]+)$/i

/**
 * The dedup key for a shared link. Facebook names one post in many shapes —
 * a group post opened from the feed is /groups/<g>?multi_permalinks=<p> with a
 * per-click __cft__ token — so the same post shared twice looked like two
 * links and was saved twice. Facebook links are reduced to the post's
 * permalink on the www. host; every link has its tracking params dropped.
 *
 * The SQL normalize_url() from the url-dedup migrations mirrors this (host,
 * trailing slash, fragment, tracking params); scripts/backfill-source-urls.ts
 * re-keys stored rows with this function when the rules here change.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(isFacebookUrl(raw) ? toPostUrl(raw) : raw)
  if (normalizeFacebookHost(url.hostname) === 'facebook.com') {
    url.hostname = 'www.facebook.com'
  }

  let pathname = url.pathname
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1)
  }

  // Drop tracking params pair by pair on the raw query, keeping the rest in
  // order. Deleting through URLSearchParams would re-encode the kept pairs
  // (%20 → +), diverging from the SQL normalize_url(), which concatenates raw
  // pairs — so both sides stay byte-for-byte identical.
  let search = url.search
  if (search) {
    const kept = search
      .slice(1)
      .split('&')
      .filter((pair) => pair !== '' && !TRACKING_PARAM_RE.test(pair.split('=')[0]))
    search = kept.length > 0 ? `?${kept.join('&')}` : ''
  }

  return `${url.protocol}//${url.host}${pathname}${search}`
}

/**
 * The key a recipe extracted from `sharedUrl` is stored under. A share
 * shortlink (/share/p/<code>, a new code per copy) only names its post once
 * the redirect is followed, so it is keyed by the post it resolved to — when
 * that is a post permalink and not, say, the login wall.
 */
export function resolvedSourceUrl(sharedUrl: string, canonicalUrl: string | undefined): string {
  if (!canonicalUrl || !isFacebookShareUrl(sharedUrl) || !isFacebookPostUrl(canonicalUrl)) return sharedUrl
  return normalizeUrl(canonicalUrl)
}

/** A LIKE pattern matching every key of the same post, or null when the key
 *  only matches itself (see groupPostKeyPattern). */
export function sourceUrlPattern(key: string): string | null {
  return groupPostKeyPattern(key)
}
