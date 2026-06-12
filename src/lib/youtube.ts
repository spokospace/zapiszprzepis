// YouTube video id helpers for S-04.
//
// Two entry points feed `recipes.youtube_id`:
//   - youtubeIdFromUrl: the shared URL itself is a YouTube link
//     (source_type = 'youtube').
//   - findEmbeddedYoutubeId: a scraped blog page (source_type = 'web_blog')
//     embeds a YouTube player; we pull the id out of the page HTML.

// A YouTube video id is exactly 11 chars from this alphabet.
const ID = '[A-Za-z0-9_-]{11}'
const ID_RE = new RegExp(`^${ID}$`)

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
])

/** Strip the www./m./music. subdomain so host comparisons are uniform.
 *  Shared with detect-source-type.ts so the host knowledge lives in one place. */
export function normalizeHost(host: string): string {
  return host.replace(/^www\./, '').replace(/^m\./, '').replace(/^music\./, '')
}

export function isYoutubeHost(host: string): boolean {
  return YOUTUBE_HOSTS.has(normalizeHost(host))
}

/**
 * Extract the 11-char video id from a direct YouTube URL.
 * Handles watch?v=, youtu.be/, /shorts/, /embed/, /live/. Returns null for
 * non-YouTube URLs or anything that doesn't yield a valid id.
 */
export function youtubeIdFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = normalizeHost(parsed.hostname)
  if (!YOUTUBE_HOSTS.has(host)) return null

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0]
    return id && ID_RE.test(id) ? id : null
  }

  // youtube.com/watch?v=<id>
  const v = parsed.searchParams.get('v')
  if (v && ID_RE.test(v)) return v

  // youtube.com/{shorts,embed,live}/<id>
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length >= 2 && ['shorts', 'embed', 'live'].includes(segments[0])) {
    const id = segments[1]
    return ID_RE.test(id) ? id : null
  }

  return null
}

// Match any YouTube link inside arbitrary HTML — iframe src, anchor href, or
// bare text. Covers embed/, youtu.be/, watch?v=, shorts/, live/.
const EMBED_RE = new RegExp(
  `(?:youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/(${ID}))` +
    `|(?:youtu\\.be/(${ID}))` +
    `|(?:youtube(?:-nocookie)?\\.com/watch\\?[^"'\\s]*v=(${ID}))`,
  'i',
)

/**
 * Find the first embedded YouTube video id in a page's HTML. Used when a blog
 * post (web_blog) embeds a player. Returns null when no embed is present.
 */
export function findEmbeddedYoutubeId(html: string): string | null {
  if (!html) return null
  const match = EMBED_RE.exec(html)
  if (!match) return null
  const id = match[1] || match[2] || match[3]
  return id && ID_RE.test(id) ? id : null
}
