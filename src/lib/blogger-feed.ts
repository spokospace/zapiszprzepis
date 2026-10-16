// Blogger (blogspot) exposes every post's content through a JSON feed, so we
// can pull the full post HTML with a single GET — no headless rendering. This
// sidesteps the Firecrawl flakiness on blogspot templates, which intermittently
// hand the scraper a Google Translate widget or an empty "main content" block
// and produce junk extractions. The feed is deterministic, fast and free.

import { pickRecipeImage } from './recipe-image-archive'
import { sliceBalancedDiv } from './html-div'

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
  const feedHtml: string = entry?.content?.$t ?? ''
  if (!feedHtml) return null

  // A blog whose feed is set to "until jump break" gives only the teaser
  // above the cut — the recipe sits below it, on the post page itself.
  const html = isCutAtJumpBreak(feedHtml) ? await fetchPostBody(parsed) : feedHtml
  if (!html) return null

  return {
    title: entry?.title?.$t ?? '',
    html,
    image: pickRecipeImage(html, url) ?? null,
  }
}

/** The feed entry ends at the jump break: its last word is a "Read more" link
 *  to the post's #more anchor. */
export function isCutAtJumpBreak(feedHtml: string): boolean {
  return /<a\b[^>]*href=["'][^"']*#more["'][^>]*>[^<]*<\/a>\s*$/i.test(feedHtml)
}

/** The post-body div of a Blogger post page — every Blogger template renders
 *  the post into one, id="post-body-<post id>". Null when there is none. */
export function extractPostBody(pageHtml: string): string | null {
  const open = /<div\b[^>]*\bid=["']post-body-\d+["'][^>]*>/i.exec(pageHtml)
  if (!open) return null
  // Ad slots and widgets inside the body carry inline scripts and styles;
  // their code is not text.
  return sliceBalancedDiv(pageHtml, open.index + open[0].length).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
}

/** The full post body, read off the post page — on the blog's own host,
 *  like the feed. Null on any failure, so the caller falls back to Firecrawl. */
async function fetchPostBody(url: URL): Promise<string | null> {
  try {
    const response = await fetch(`https://${url.hostname}${url.pathname}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15_000),
    })
    return response.ok ? extractPostBody(await response.text()) : null
  } catch {
    return null
  }
}
