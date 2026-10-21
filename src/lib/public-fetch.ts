// Fetching a page the user shared, as a browser would. The URL comes from the
// user, so the same SSRF guard as image archiving applies to it and to every
// redirect it takes.

import { isPrivateUrl } from './recipe-image-archive'

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

interface Options {
  fetch: typeof globalThis.fetch
  /** Hops to follow; 0 treats any redirect as a failure. */
  maxRedirects?: number
}

/**
 * A public page's HTML, following redirects one hop at a time so none can
 * bounce the request to a private address — WordPress sends a link without
 * its trailing slash through a 301. Null on any failure.
 */
export async function fetchPublicHtml(url: string, { fetch, maxRedirects = 5 }: Options): Promise<string | null> {
  let current = url
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (isPrivateUrl(current)) return null
      const response = await fetch(current, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl-PL,pl;q=0.9' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null
      if (!location) return response.ok ? await response.text() : null
      current = new URL(location, current).href
    }
  } catch {
    // An unreachable page or a malformed redirect: no HTML.
  }
  return null
}
