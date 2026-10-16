// Blogger (blogspot) exposes every post's content through a JSON feed, so we
// can pull the full post HTML with a single GET — no headless rendering. This
// sidesteps the Firecrawl flakiness on blogspot templates, which intermittently
// hand the scraper a Google Translate widget or an empty "main content" block
// and produce junk extractions. The feed is deterministic, fast and free.

import { extractFirstImage } from './recipe-image-archive'

export function isBlogspotUrl(url: string): boolean {
  try {
    // Match every blogspot TLD, not just .com — Blogger serves the same post on
    // country-coded mirrors (foo.blogspot.de, foo.blogspot.co.uk, …) and they all
    // expose the JSON feed. Anchored at the end so foo.blogspot.com.evil.com is
    // rejected. Covers single (.de) and two-part (.co.uk) TLDs.
    return /\.blogspot\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Whether the URL may be a Blogger post: either a blogspot host, or a custom
 * domain whose path has Blogger's fixed post shape `/YYYY/MM/slug.html`
 * (e.g. lekcjewkuchni.pl). The custom-domain case is only a guess — the feed
 * fetch confirms it, and returns null for any non-Blogger site.
 */
export function mayBeBloggerPost(url: string): boolean {
  if (isBlogspotUrl(url)) return true
  try {
    return /^\/\d{4}\/\d{2}\/[^/]+\.html$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

export interface BloggerPost {
  title: string
  html: string
  image: string | null
}

/**
 * Fetch a single blogspot post via the Blogger JSON feed, filtered to the post
 * path. Works on custom domains too (the feed lives on the blog's own host).
 * Returns null when there is no Blogger feed or no matching entry (non-Blogger
 * site, disabled feed) so callers can fall back to a normal scrape.
 */
export async function fetchBloggerPost(url: string): Promise<BloggerPost | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  // `path` filters the feed to the one post; verified to return exactly that
  // entry with full `content.$t`. Pathname is ASCII (Blogger transliterates
  // slugs), so it's safe to pass as-is.
  const feedUrl = `https://${parsed.hostname}/feeds/posts/default?alt=json&path=${parsed.pathname}`

  const response = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  // A custom-domain guess (see mayBeBloggerPost) can land on a site that
  // answers any path with an HTML page — that is "not Blogger", not an error.
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) return null

  const data = await response.json()
  const entry = data?.feed?.entry?.[0]
  const html: string = entry?.content?.$t ?? ''
  if (!html) return null

  return {
    title: entry?.title?.$t ?? '',
    html,
    image: extractFirstImage(html) ?? null,
  }
}
