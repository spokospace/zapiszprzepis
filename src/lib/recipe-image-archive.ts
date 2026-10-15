import type { SupabaseClient } from '@supabase/supabase-js'
import { slugify } from './slugify'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

// Private/loopback/cloud-metadata hostnames and prefixes that must never be
// fetched server-side. A content-controlled og:image could point here (SSRF).
const BLOCKED_HOSTS = new Set(['localhost', '169.254.169.254', 'metadata.google.internal'])

/**
 * Returns true when the URL resolves to a private, loopback, link-local, or
 * cloud-metadata address that must not be fetched from the server side.
 * Returns true on parse failure — an invalid URL should never be fetched.
 */
export function isPrivateUrl(url: string): boolean {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return true
  }
  if (BLOCKED_HOSTS.has(hostname)) return true
  // Strip IPv6 brackets: [::1] → ::1
  const h = hostname.replace(/^\[|\]$/g, '')
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true
  // IPv6 link-local (fe80::/10), unique-local (fc00::/7 → fc/fd prefixes)
  if (h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd')) return true
  // IPv4 private / loopback ranges
  if (
    h.startsWith('127.') ||
    h.startsWith('0.') ||
    h.startsWith('10.') ||
    h.startsWith('169.254.') ||
    h.startsWith('192.168.')
  ) return true
  // 172.16.0.0/12 → 172.16.x.x – 172.31.x.x
  const parts = h.split('.')
  if (parts.length === 4 && parts[0] === '172') {
    const second = Number(parts[1])
    if (second >= 16 && second <= 31) return true
  }
  return false
}

export async function archiveImage(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  externalUrl: string,
): Promise<string | null> {
  try {
    if (isPrivateUrl(externalUrl)) {
      console.warn(`[archiveImage] blocked private/metadata URL: ${externalUrl}`)
      return null
    }

    const response = await fetch(externalUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) {
      console.warn(`[archiveImage] download ${response.status} for ${externalUrl}`)
      return null
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    const ext = ALLOWED_MIME[contentType]
    if (!ext) {
      console.warn(`[archiveImage] unsupported MIME ${contentType} for ${externalUrl}`)
      return null
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      console.warn(`[archiveImage] too large ${contentLength}B for ${externalUrl}`)
      return null
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) {
      console.warn(`[archiveImage] too large after read ${bytes.byteLength}B for ${externalUrl}`)
      return null
    }

    const path = `${userId}/${recipeId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, bytes, { contentType, upsert: true })

    if (uploadError) {
      console.warn(`[archiveImage] upload failed: ${uploadError.message}`)
      return null
    }

    const { data: publicUrl } = supabase.storage.from('recipe-images').getPublicUrl(path)
    return publicUrl.publicUrl
  } catch (error) {
    console.warn(`[archiveImage] error: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

export function extractStoragePath(imageUrl: string): string | null {
  const match = imageUrl.match(/\/storage\/v1\/object\/public\/recipe-images\/(.+)$/)
  return match ? match[1] : null
}

const ATTR_RE = /\bdata-lazy-src=["']([^"']+)["']|\bdata-src=["']([^"']+)["']|\bsrc=["']([^"']+)["']/i
// URLs that are never the dish: page chrome (avatars, logos, icons) and ads or
// tracking pixels. A pixel is usually served by a script (`.php`, an analytics
// host) as a GIF. archiveImage would reject it, but the failed-archive fallback
// would still store its URL as the cover (mniammniam's `pbook_ctr.php`), so it
// has to be dropped before it is picked.
const NOT_A_PHOTO_RE =
  /gravatar|avatar|\/logo|favicon|[/_-]icons?[/_.-]|emoji|sprite|spacer|placeholder|doubleclick|quantserve|google-analytics|googletagmanager|facebook\.com\/tr|pinterest\.com\/images|pixel|\/ads?\/|banner|\.(php|gif|svg)(\?|$)|^data:/i
const AD_CLASS_RE = /\bclass=["'][^"']*(reklama|advert|\bads?\b|banner|sponsor)/i
const ITEMPROP_IMAGE_RE = /\bitemprop=["']image["']/i
const WIDTH_RE = /\bwidth=["']?(\d+)/i
const HEIGHT_RE = /\bheight=["']?(\d+)/i
const ALT_RE = /\balt=["']([^"']*)["']/i

/** Lowercase ASCII words of 4+ letters — enough to match "ptysie" in a slug, a file name and an alt text alike. */
function words(text: string): Set<string> {
  return new Set(slugify(text).split(/[^a-z]+/).filter((w) => w.length >= 4))
}

/**
 * Picks the recipe photo out of a page's `<img>` tags, for pages without an
 * og:image. Ads, tracking pixels and icons are dropped; of the rest, the image
 * the page marks as its schema.org image wins, then one whose file name or alt
 * text shares a word with the page's URL slug, then a large one — the first
 * survivor otherwise. Relative URLs are resolved against `pageUrl`.
 */
export function pickRecipeImage(html: string, pageUrl?: string): string | undefined {
  let base: URL | undefined
  try {
    if (pageUrl) base = new URL(pageUrl)
  } catch {
    // An unparsable page URL only costs the slug bonus and URL resolution.
  }
  const slugWords = base ? words(base.pathname) : new Set<string>()

  let best: { url: string; score: number } | undefined
  for (const tag of html.match(/<img\b[^>]+>/gi) ?? []) {
    const m = ATTR_RE.exec(tag)
    const raw = m?.[1] ?? m?.[2] ?? m?.[3]
    if (!raw || NOT_A_PHOTO_RE.test(raw) || AD_CLASS_RE.test(tag)) continue

    let url = raw
    if (base) {
      try {
        url = new URL(raw, base).href
      } catch {
        continue
      }
    }

    // A missing width/height parses to NaN, which fails both comparisons, so
    // only images that declare a small size are dropped.
    const width = Number(WIDTH_RE.exec(tag)?.[1] ?? NaN)
    const height = Number(HEIGHT_RE.exec(tag)?.[1] ?? NaN)
    if (width < 100 || height < 100) continue

    let score = 0
    if (ITEMPROP_IMAGE_RE.test(tag)) score += 100
    const imageWords = words(`${url.split(/[?#]/)[0].split('/').pop()} ${ALT_RE.exec(tag)?.[1] ?? ''}`)
    if ([...imageWords].some((w) => slugWords.has(w))) score += 20
    if (width >= 300 || height >= 300) score += 5

    if (!best || score > best.score) best = { url, score }
  }
  return best?.url
}
