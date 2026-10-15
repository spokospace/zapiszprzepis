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

/** Archives a recipe's cover image as `<user>/<recipe>.<ext>`. */
export function archiveImage(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  externalUrl: string,
): Promise<string | null> {
  return archiveImageAt(supabase, galleryFolder(userId, recipeId), externalUrl)
}

/**
 * Downloads `externalUrl` and stores it at `<pathStem>.<ext>` in the
 * recipe-images bucket. Returns the public Storage URL, or null on any failure.
 */
async function archiveImageAt(
  supabase: SupabaseClient,
  pathStem: string,
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

    const path = `${pathStem}.${ext}`
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
  /gravatar|avatar|\/logo|favicon|[/_-]icons?[/_.-]|[/_-]buttons?[/_.-]|emoji|sprite|spacer|placeholder|doubleclick|quantserve|google-analytics|googletagmanager|facebook\.com\/tr|pinterest\.com\/images|pixel|\/ads?\/|banner|\.(php|gif|svg)(\?|$)|^data:/i
const AD_CLASS_RE = /\bclass=["'][^"']*(reklama|advert|\bads?\b|banner|sponsor)/i
const ITEMPROP_IMAGE_RE = /\bitemprop=["']image["']/i
const WIDTH_RE = /\bwidth=["']?(\d+)/i
const HEIGHT_RE = /\bheight=["']?(\d+)/i
const ALT_RE = /\balt=["']([^"']*)["']/i

/** Lowercase ASCII words of 4+ letters — enough to match "ptysie" in a slug, a file name and an alt text alike. */
function words(text: string): Set<string> {
  return new Set(slugify(text).split(/[^a-z]+/).filter((w) => w.length >= 4))
}

function parseBase(pageUrl?: string): URL | undefined {
  try {
    return pageUrl ? new URL(pageUrl) : undefined
  } catch {
    // An unparsable page URL only costs the slug bonus and URL resolution.
    return undefined
  }
}

interface ImageTag {
  url: string
  tag: string
  /** Declared size; NaN when the tag declares none. */
  width: number
  height: number
}

/**
 * The page's `<img>` tags that could be a photo of the dish, in document
 * order: ads, tracking pixels and icons are dropped, and relative URLs are
 * resolved against `base`.
 */
function photoTags(html: string, base: URL | undefined): ImageTag[] {
  const tags: ImageTag[] = []
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
    tags.push({
      url,
      tag,
      width: Number(WIDTH_RE.exec(tag)?.[1] ?? NaN),
      height: Number(HEIGHT_RE.exec(tag)?.[1] ?? NaN),
    })
  }
  return tags
}

/**
 * Picks the recipe photo out of a page's `<img>` tags, for pages without an
 * og:image. Ads, tracking pixels and icons are dropped; of the rest, the image
 * the page marks as its schema.org image wins, then one whose file name or alt
 * text shares a word with the page's URL slug, then a large one — the first
 * survivor otherwise. Relative URLs are resolved against `pageUrl`.
 */
export function pickRecipeImage(html: string, pageUrl?: string): string | undefined {
  const base = parseBase(pageUrl)
  const slugWords = base ? words(base.pathname) : new Set<string>()

  let best: { url: string; score: number } | undefined
  for (const { url, tag, width, height } of photoTags(html, base)) {
    // A missing width/height parses to NaN, which fails both comparisons, so
    // only images that declare a small size are dropped.
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

/** Most photos a recipe keeps. A step-by-step post runs to about a dozen. */
export const GALLERY_LIMIT = 12

// Images inside a post that are still not the recipe's own photos: readers'
// photos under the comments, cards linking to other recipes, author badges.
const NOT_GALLERY_RE = /\bclass=["'][^"']*(comment|related|similar|recommend|popular|author|profile|avatar|widget)/i
const NOT_GALLERY_URL_RE = /\/comments?\//i
// A thumbnail size baked into the file name: WordPress `-150x150.jpg`,
// aniagotuje `-v-360x360.jpg`.
const FILE_SIZE_RE = /[-_](\d{2,4})x(\d{2,4})(?=\.\w+$)/
// Below this on the long side an image is a thumbnail or badge, not a photo
// worth a gallery slot.
const MIN_GALLERY_SIDE = 400

const BLOGGER_IMAGE_HOST_RE = /(^|\.)bp\.blogspot\.com$|^blogger\.googleusercontent\.com$/
const BLOGGER_SIZE_SEGMENT_RE = /\/(?:s\d+|w\d+-h\d+)(?:-[a-z0-9-]+)?\//
const BLOGGER_SIZE_SUFFIX_RE = /=(?:s\d+|w\d+-h\d+)(?:-[a-z0-9-]+)?$/

/**
 * Blogger serves post photos as small thumbnails that link to the full size;
 * the size lives in the URL, so ask for the large rendition instead.
 */
function bloggerFullSize(url: URL): string | null {
  if (!BLOGGER_IMAGE_HOST_RE.test(url.hostname)) return null
  return url.href.replace(BLOGGER_SIZE_SEGMENT_RE, '/s1600/').replace(BLOGGER_SIZE_SUFFIX_RE, '=s1600')
}

/**
 * Identity of a photo across its renditions — the same file at another size
 * or on another CDN edge (`scontent-waw2-1` vs `-2`) is one photo.
 */
function photoKey(url: string): string {
  try {
    return new URL(url).pathname
      .toLowerCase()
      .replace(BLOGGER_SIZE_SEGMENT_RE, '/')
      .replace(/(-v)?[-_]\d{2,4}x\d{2,4}(?=\.\w+$)/, '')
      .replace(/-scaled(?=\.\w+$)/, '')
  } catch {
    return url
  }
}

// Words in a container's class or id that mark a page section holding no photo
// of this recipe: ads and banners, cards linking to other recipes, comments,
// sidebars. Matched against whole `-`/`_`-separated words, so kuron's
// `jku-similar-posts-wrapper` and `empik-banner` match, while its
// `UFICommentBody` — a Facebook post pasted into the recipe, the dish's photos
// included — does not.
const NOISE_SECTION_WORDS = new Set([
  'ad', 'ads', 'advert', 'advertisement', 'reklama', 'banner', 'sponsor', 'sponsored',
  'related', 'similar', 'recommended', 'popular',
  'comment', 'comments', 'author', 'sidebar', 'widget', 'newsletter',
  'printfriendly',
])
const SECTION_OPEN_RE = /<(div|section|aside|nav|footer|ul|ol|li|figure|a|ins|span)\b[^>]*>/gi
const CLASS_OR_ID_RE = /\b(?:class|id)=["']([^"']*)["']/gi
// One open-or-close matcher per section tag name, built on first use.
const SAME_TAG_RES = new Map<string, RegExp>()

function isNoiseSection(openTag: string): boolean {
  for (const [, value] of openTag.matchAll(CLASS_OR_ID_RE)) {
    if (value.split(/[\s_-]+/).some((w) => NOISE_SECTION_WORDS.has(w.toLowerCase()))) return true
  }
  return false
}

/**
 * The html with every noise section cut out, each up to its own closing tag.
 * A section whose closing tag is missing is left in — cutting to the end of
 * the page on broken markup could drop the recipe's own photos.
 */
function withoutNoiseSections(html: string): string {
  let out = ''
  let from = 0
  SECTION_OPEN_RE.lastIndex = 0
  for (let m = SECTION_OPEN_RE.exec(html); m; m = SECTION_OPEN_RE.exec(html)) {
    if (!isNoiseSection(m[0])) continue
    const name = m[1].toLowerCase()
    let sameTag = SAME_TAG_RES.get(name)
    if (!sameTag) SAME_TAG_RES.set(name, (sameTag = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi')))
    sameTag.lastIndex = SECTION_OPEN_RE.lastIndex
    let depth = 1
    let end = -1
    for (let t = sameTag.exec(html); t; t = sameTag.exec(html)) {
      depth += t[1] ? -1 : 1
      if (depth === 0) {
        end = sameTag.lastIndex
        break
      }
    }
    if (end < 0) continue
    out += html.slice(from, m.index)
    from = end
    SECTION_OPEN_RE.lastIndex = end
  }
  return out + html.slice(from)
}

/**
 * The photos of the recipe itself, in page order, for the gallery under the
 * recipe: everything `photoTags` keeps, minus thumbnails, readers' comment
 * photos, ads and links to other recipes.
 */
export function pickGalleryImages(html: string, pageUrl?: string): string[] {
  const base = parseBase(pageUrl)
  const urls: string[] = []
  for (const { url, tag, width, height } of photoTags(withoutNoiseSections(html), base)) {
    if (NOT_GALLERY_RE.test(tag) || NOT_GALLERY_URL_RE.test(url)) continue

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    const blogger = bloggerFullSize(parsed)
    if (blogger) {
      urls.push(blogger)
      continue
    }

    // The size in the file name is the file's own, so it outranks the tag's,
    // which pages abuse (aniagotuje declares its 1000px hero as 1×1).
    const fileSize = FILE_SIZE_RE.exec(parsed.pathname)
    const side = fileSize
      ? Math.max(Number(fileSize[1]), Number(fileSize[2]))
      : Math.max(width, height)
    // NaN — no size anywhere — passes: most in-post photos declare none.
    if (side < MIN_GALLERY_SIDE) continue
    urls.push(url)
  }
  return urls
}

/**
 * The gallery to store: the cover first, then the other photos, each photo
 * once, at most GALLERY_LIMIT. Empty when there is nothing beyond the cover —
 * one photo is already shown as the cover.
 */
export function buildGallery(cover: string | undefined, photos: string[]): string[] {
  const seen = new Set<string>()
  const gallery: string[] = []
  for (const url of cover ? [cover, ...photos] : photos) {
    const key = photoKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    gallery.push(url)
    if (gallery.length === GALLERY_LIMIT) break
  }
  return gallery.length > 1 ? gallery : []
}

/** Storage folder holding a recipe's gallery, beside its `<recipe>.<ext>` cover. */
function galleryFolder(userId: string, recipeId: number): string {
  return `${userId}/${recipeId}`
}

/** Deletes every file in a recipe's gallery folder. Never throws. */
export async function removeGallery(supabase: SupabaseClient, userId: string, recipeId: number): Promise<void> {
  const folder = galleryFolder(userId, recipeId)
  const bucket = supabase.storage.from('recipe-images')
  const { data, error } = await bucket.list(folder)
  if (error) {
    console.warn(`[removeGallery] list failed: ${error.message}`)
    return
  }
  if (!data?.length) return
  const { error: removeError } = await bucket.remove(data.map((file) => `${folder}/${file.name}`))
  if (removeError) console.warn(`[removeGallery] remove failed: ${removeError.message}`)
}

/**
 * Archives the gallery as `<user>/<recipe>/<n>.<ext>` and returns the Storage
 * URLs of the photos that made it, in order. Photos that fail to download are
 * left out rather than kept as external links: Facebook's expire within days.
 * `archivedCover` stands in for `sources[0]`, which buildGallery makes the
 * cover, so it is not downloaded twice.
 */
export async function archiveGallery(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  sources: string[],
  archivedCover: string | null,
): Promise<string[]> {
  // A refresh may find fewer photos than last time; stale files must not linger.
  await removeGallery(supabase, userId, recipeId)
  const folder = galleryFolder(userId, recipeId)
  const archived = await Promise.all(
    sources.map((source, i) =>
      i === 0 && archivedCover ? archivedCover : archiveImageAt(supabase, `${folder}/${i}`, source),
    ),
  )
  return archived.filter((url): url is string => url != null)
}

/**
 * Archives a recipe's cover and gallery. The gallery is only touched when
 * there is one, or when `clearStale` asks for an old one to be emptied (a
 * refresh replaces the gallery outright).
 */
export async function archiveRecipeImages(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  cover: string | undefined,
  gallery: string[],
  { clearStale = false }: { clearStale?: boolean } = {},
): Promise<{ cover: string | null; gallery: string[] }> {
  const archivedCover = cover != null ? await archiveImage(supabase, userId, recipeId, cover) : null
  const archivedGallery =
    gallery.length > 0 || clearStale
      ? await archiveGallery(supabase, userId, recipeId, gallery, archivedCover)
      : []
  return { cover: archivedCover, gallery: archivedGallery }
}
