import { isFacebookUrl, normalizeFacebookHost, toPostUrl } from './facebook'

/**
 * The dedup key for a shared link. Facebook names one post in many shapes —
 * a group post opened from the feed is /groups/<g>?multi_permalinks=<p> with a
 * per-click __cft__ token — so the same post shared twice looked like two
 * links and was saved twice. Facebook links are reduced to the post's
 * permalink, without tracking params, on the www. host.
 *
 * The SQL normalize_url() from the url-dedup migration mirrors only the
 * generic part; scripts/backfill-source-urls.ts re-keys stored rows with this
 * function when the rules here change.
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

  return `${url.protocol}//${url.host}${pathname}${url.search}`
}
