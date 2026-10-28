// Jina Reader (r.jina.ai) renders a page and returns it as markdown — free;
// JINA_API_KEY is optional but production needs it (see readMarkdown). It stands in for
// Firecrawl when that fails or runs out of credits (HTTP 402): the markdown
// feeds the LLM, and the page's own HTML, fetched directly, keeps the photos,
// JSON-LD and embedded players the rest of the pipeline reads.

import { isPrivateUrl, namesTheDish } from './recipe-image-archive'
import { fetchPublicHtml } from './public-fetch'
import { decodeEntities } from './html-entities'

const JINA_READER = 'https://r.jina.ai/'

// og:image as <meta property="og:image" content="…"> or the reverse attribute
// order. Jina's JSON names it only for some sites — a Nuxt SSR blog like
// aniagotuje.pl comes back without it — so it is recovered from the raw HTML
// the reader fetches alongside, the page's own tag, which coverImage needs when
// the in-page scan finds only thumbnails and the JSON-LD only an avatar.
const OG_IMAGE_RE =
  /<meta[^>]+?\bproperty=["']og:image["'][^>]*?\bcontent=["']([^"']+)["']|<meta[^>]+?\bcontent=["']([^"']+)["'][^>]*?\bproperty=["']og:image["']/i

function ogImageFromHtml(html: string): string | undefined {
  const match = OG_IMAGE_RE.exec(html)
  const href = match?.[1] ?? match?.[2]
  return href ? decodeEntities(href) : undefined
}

/**
 * The page HTML cut down to its content, the way Firecrawl's onlyMainContent
 * html already is. The raw page the reader fetches is the whole document — a
 * Nuxt/SSR blog (aniagotuje.pl) inlines ~90 KB of CSS, JS and preload links in
 * <head> alone, which pushes the article (and its per-step <img> and gallery
 * photos) well past the first slice the LLM and the photo scans actually read,
 * so step photos and the gallery come up empty on the fallback path. Drop the
 * non-content tags — scripts (but keep ld+json, which the deterministic readers
 * parse), styles, SVG icons, <link>/<noscript>/<template> and comments —
 * leaving the article near the front. Never touches content elements, so a page
 * with no such chrome is returned effectively unchanged.
 */
export function readableHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b(?![^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<(style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
}

/** The same shape as Firecrawl's scrape `data`, so callers take either. */
export interface ReaderPage {
  markdown: string
  html: string
  metadata: { url?: string; ogImage?: string; statusCode?: number }
}

interface Deps {
  fetch: typeof globalThis.fetch
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

interface ReaderImage {
  url: string
  alt: string
}

/**
 * The page's images from Jina's image summary, in page order. Its keys read
 * `Image 4,1: fig jam pizza` — the alt after the colon. A lazy-loaded photo
 * shows up there (and in the markdown) as a `blob:` URL of Jina's own browser,
 * next to the real URL of the same photo; only real http(s) URLs are kept.
 */
function summaryImages(images: unknown): ReaderImage[] {
  if (!images || typeof images !== 'object') return []
  const out: ReaderImage[] = []
  for (const [key, value] of Object.entries(images)) {
    const url = str(value)
    // Written into a src attribute verbatim (an entity there would never be
    // decoded on the way to the archiver), so a URL that would need one is skipped.
    if (!/^https?:\/\/[^\s"'<>]+$/i.test(url)) continue
    out.push({ url, alt: key.split(/:\s*/).slice(1).join(': ').trim() })
  }
  return out
}

async function readMarkdown(
  url: string,
  { fetch }: Deps,
): Promise<Omit<ReaderPage, 'html'> & { images: ReaderImage[] }> {
  // Keyless, Jina limits by IP, and Cloudflare Workers share their egress
  // IPs: production gets HTTP 429. With a key the limit is the key's own.
  const key = process.env.JINA_API_KEY
  const response = await fetch(`${JINA_READER}${url}`, {
    headers: {
      Accept: 'application/json',
      // The page's image URLs, for when neither HTML source gets past the
      // site's bot check (see readerScrape).
      'X-With-Images-Summary': 'true',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json())?.data
  const content = str(data?.content)
  if (!content) throw new Error('no content')
  // The markdown often starts below the post's heading; the title is the
  // LLM's strongest signal, so it leads.
  const title = str(data.title)
  return {
    markdown: title && !content.includes(title) ? `# ${title}\n\n${content}` : content,
    metadata: {
      url: str(data.url) || undefined,
      ogImage: str(data.metadata?.['og:image']) || undefined,
      statusCode: typeof data.httpStatus === 'number' ? data.httpStatus : undefined,
    },
    images: summaryImages(data.images),
  }
}

const escapeAlt = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * `<img>` tags for the summary images that name the dish, so the gallery and
 * step-photo scans, which read HTML, see them. Only those: stripped of its
 * markup, the summary cannot otherwise tell a photo of the recipe from the
 * site's logo, the author's portrait or a book cover in the sidebar.
 */
function dishImageTags(images: ReaderImage[], pageUrl: string): string {
  const isDish = namesTheDish(pageUrl)
  return images
    .filter(({ url, alt }) => isDish(url, alt))
    .map(({ url, alt }) => `<img src="${url}" alt="${escapeAlt(alt)}">`)
    .join('\n')
}

// A bot-check interstitial (Cloudflare's "Just a moment…") instead of the page.
const BLOCKED_PAGE_RE = /challenge-platform|cf-chl-|<title>\s*(?:Just a moment|Attention Required)/i

/**
 * The page's HTML as Jina renders it, from Jina's own servers. Some sites refuse
 * the Worker's Cloudflare addresses (aniagotuje.pl: text and cover came through
 * Jina, but no gallery or step photo ever did), so the direct fetch yields
 * nothing; Jina still reaches them. Empty on any failure — only photos ride on it.
 */
async function readHtml(url: string, { fetch }: Deps): Promise<string> {
  try {
    const key = process.env.JINA_API_KEY
    const response = await fetch(`${JINA_READER}${url}`, {
      headers: {
        Accept: 'application/json',
        'X-Return-Format': 'html',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) return ''
    const html = str((await response.json())?.data?.html)
    // Jina's browser can be stopped by the same bot check (howsweeteats.com).
    // Tested without scripts: Cloudflare puts its `challenge-platform` beacon
    // on ordinary pages too.
    return BLOCKED_PAGE_RE.test(readableHtml(html)) ? '' : html
  } catch {
    return ''
  }
}

/**
 * The page through Jina Reader plus its raw HTML. Throws "Jina Reader: …" with
 * the reason when Jina has no content for it, so the caller can store why.
 */
export async function readerScrape(url: string, deps: Deps): Promise<ReaderPage> {
  if (isPrivateUrl(url)) throw new Error('Jina Reader: private address')
  const [{ images, ...read }, html] = await Promise.all([
    readMarkdown(url, deps).catch((err) => {
      throw new Error(`Jina Reader: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
    }),
    fetchPublicHtml(url, deps),
  ])
  // The page's own HTML, fetched directly; when the site refuses the Worker
  // (no page, or a bot check), the copy Jina rendered instead.
  const rawHtml = html?.trim() && !BLOCKED_PAGE_RE.test(html) ? html : await readHtml(url, deps)
  // Jina's metadata names og:image only sometimes; fall back to the raw HTML's
  // own tag so a page whose only good cover is its og:image still gets one.
  const ogImage = read.metadata.ogImage ?? ogImageFromHtml(rawHtml)
  // Hand on the content-only HTML (see readableHtml) so the LLM's per-step image
  // picks and the gallery/cover scans reach the article, not ~90 KB of <head>.
  let content = readableHtml(rawHtml)
  // No photo in it — the site turned both HTML fetches away — but the markdown
  // read got through: its image summary stands in, or the gallery comes up empty.
  if (!/<img\b/i.test(content)) content = [content, dishImageTags(images, url)].filter(Boolean).join('\n')
  return { ...read, html: content, metadata: { ...read.metadata, ogImage } }
}
