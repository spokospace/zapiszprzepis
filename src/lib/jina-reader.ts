// Jina Reader (r.jina.ai) renders a page and returns it as markdown — free;
// JINA_API_KEY is optional but production needs it (see readMarkdown). It stands in for
// Firecrawl when that fails or runs out of credits (HTTP 402): the markdown
// feeds the LLM, and the page's own HTML, fetched directly, keeps the photos,
// JSON-LD and embedded players the rest of the pipeline reads.

import { isPrivateUrl } from './recipe-image-archive'
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

async function readMarkdown(url: string, { fetch }: Deps): Promise<Omit<ReaderPage, 'html'>> {
  // Keyless, Jina limits by IP, and Cloudflare Workers share their egress
  // IPs: production gets HTTP 429. With a key the limit is the key's own.
  const key = process.env.JINA_API_KEY
  const response = await fetch(`${JINA_READER}${url}`, {
    headers: { Accept: 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
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
  }
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
    return str((await response.json())?.data?.html)
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
  const [read, html] = await Promise.all([
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
  return { ...read, html: readableHtml(rawHtml), metadata: { ...read.metadata, ogImage } }
}
