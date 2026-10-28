import type { SupabaseClient } from '@supabase/supabase-js'
import { slugify } from './slugify'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

// Loopback/cloud-metadata hostnames that must never be fetched server-side.
// A content-controlled og:image could point here (SSRF).
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal'])

const IPV4_RE = /^(\d+)\.(\d+)\.\d+\.\d+$/

/**
 * Returns true when the URL points at a private, loopback, link-local, or
 * cloud-metadata address that must not be fetched from the server side.
 * Returns true on parse failure — an invalid URL should never be fetched.
 *
 * Only an IP literal is judged by its address range. `new URL` already turns
 * every IPv4 spelling (2130706433, 0x7f.1, 0177.0.0.1) into dotted decimal and
 * every IPv6 one into its compressed hex form, so a DNS name like
 * fcdn.example.com or 0.cdn.example.com is never mistaken for an address
 * (#136). A DNS name that resolves to a private address is not caught here;
 * the Worker's global_fetch_strictly_public flag covers that in production.
 */
export function isPrivateUrl(url: string): boolean {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return true
  }
  if (BLOCKED_HOSTS.has(hostname)) return true
  if (hostname.startsWith('[')) return isPrivateIPv6(hostname.slice(1, -1))
  const ipv4 = IPV4_RE.exec(hostname)
  return ipv4 != null && isPrivateIPv4(Number(ipv4[1]), Number(ipv4[2]))
}

// 0.0.0.0/8, 10/8, 127/8, 169.254/16 (cloud metadata), 172.16/12, 192.168/16.
function isPrivateIPv4(a: number, b: number): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIPv6(address: string): boolean {
  const [head, tail] = address.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const words = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right].map((w) => parseInt(w, 16))
  const zeroPrefix = (n: number) => words.slice(0, n).every((w) => w === 0)
  // ::ffff:a.b.c.d (written in hex by `new URL`) reaches the embedded IPv4 address.
  if (zeroPrefix(5) && words[5] === 0xffff) return isPrivateIPv4(words[6] >> 8, words[6] & 0xff)
  // :: (unspecified) and ::1 (loopback)
  if (zeroPrefix(7)) return words[7] <= 1
  // fe80::/10 link-local, fc00::/7 unique-local
  return (words[0] & 0xffc0) === 0xfe80 || (words[0] & 0xfe00) === 0xfc00
}

// Some hosts refuse requests coming from Cloudflare's address space (seen
// with najprzepis.pl: the Worker gets no image while any other client does).
// wsrv.nl fetches the image from its own servers, so it is the last try when
// the direct download fails. This is the ONLY use of the proxy left — it runs
// server-side at archive time and the bytes land in Supabase Storage, so no
// wsrv.nl URL ever reaches a rendered page. The proxy only sees public URLs
// (isPrivateUrl runs before any fetch).
const IMAGE_PROXY = 'https://wsrv.nl/?url='

/**
 * The wsrv.nl URL used to DOWNLOAD an image for archiving when the host refuses
 * the Worker directly. It asks for a WebP rendition capped at 1600px on the long
 * side: WebP keeps the stored copy under the 5 MB archive cap where a full-size
 * JPEG/PNG would blow it (the gap that used to leave covers un-archived and
 * served through the proxy at render time), and normalises the response MIME to
 * one archiveImage accepts. 1600px is ample — the cover is never rendered wider
 * than ~1280px.
 */
export function proxiedImageUrl(externalUrl: string): string {
  return `${IMAGE_PROXY}${encodeURIComponent(externalUrl)}&w=1600&output=webp&q=82`
}

/**
 * The <Image> src for a recipe cover, or null when there is none to show (the
 * caller renders the NoPhoto placeholder instead). `image_url` is always a
 * Supabase Storage URL or null — the pipeline never persists an external link —
 * so an archived cover passes straight through next/image's optimizer. A
 * non-archived value is only a legacy row still awaiting the archive backfill:
 * it is shown as NoPhoto, never hotlinked, so no third-party proxy appears in
 * the page source.
 */
export function coverImageSrc(imageUrl: string | null | undefined): string | null {
  return imageUrl != null && isArchivedImageUrl(imageUrl) ? imageUrl : null
}

// Polish shared hosting (home.pl, nazwa.pl) often serves a domain over https
// with the host's default certificate — `*.home.pl` on babskieporady.pl — which
// matches neither the domain nor any SAN, so the TLS handshake fails both here
// and in the reader's browser. The file itself is served fine over plain http,
// so an https URL whose fetch failed at the transport layer is retried over
// http before the proxy. Downgrading the scheme is safe for a public recipe
// photo: no credentials ride along, and the SSRF guard already ran on the same
// host.
export function insecureHttpUrl(url: string): string | null {
  return url.startsWith('https://') ? `http://${url.slice('https://'.length)}` : null
}

interface DownloadedImage {
  bytes: Uint8Array
  contentType: string
  ext: string
}

interface DownloadResult {
  image: DownloadedImage | null
  // True only for a transport-layer failure worth retrying over plain http: a
  // TLS cert mismatch or a connection error (both throw). A refused status,
  // wrong MIME, oversize, or a timeout is false — http would not help, so the
  // caller skips straight to the proxy.
  transportError: boolean
}

async function downloadImage(url: string): Promise<DownloadResult> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (error) {
    console.warn(`[archiveImage] download failed for ${url}: ${error instanceof Error ? error.message : String(error)}`)
    // A timeout won't resolve any faster over http, so it is not a retry case.
    return { image: null, transportError: !(error instanceof Error) || error.name !== 'TimeoutError' }
  }
  if (!response.ok) {
    console.warn(`[archiveImage] download ${response.status} for ${url}`)
    return { image: null, transportError: false }
  }

  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  const ext = ALLOWED_MIME[contentType]
  if (!ext) {
    console.warn(`[archiveImage] unsupported MIME ${contentType} for ${url}`)
    return { image: null, transportError: false }
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    console.warn(`[archiveImage] too large ${contentLength}B for ${url}`)
    return { image: null, transportError: false }
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) {
    console.warn(`[archiveImage] too large after read ${bytes.byteLength}B for ${url}`)
    return { image: null, transportError: false }
  }

  return { image: { bytes, contentType, ext }, transportError: false }
}

/**
 * Fetches an image, recovering from the two ways a host defeats the Worker:
 * direct first; a transport failure (a TLS cert mismatch on an SSL-broken
 * host) retries the same file over plain http; any other failure, and a failed
 * http retry, falls to the proxy (for a host that refuses the Worker's address
 * space outright). Null when none of them yields an image.
 */
async function fetchImage(url: string): Promise<DownloadedImage | null> {
  const httpUrl = insecureHttpUrl(url)
  let result = await downloadImage(url)
  if (!result.image && result.transportError && httpUrl) {
    result = await downloadImage(httpUrl)
  }
  if (!result.image) {
    result = await downloadImage(proxiedImageUrl(url))
  }
  return result.image
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

    // Prefer the full-size original — a WordPress resize URL may 301
    // (kulinarnapolska.org) — but fall back to the URL as found when the
    // original is missing or too big to archive (the 5 MB cap), so a resize
    // that would archive cleanly is never traded for a broken cover. The
    // original is a guess, so it gets one direct try: its 404 (aniagotuje's
    // -v-1080x1080 has no bare file) means "no such file", which the http
    // retry and the proxy cannot change — they cost two more fetches a photo.
    const fullUrl = fullSizeImageUrl(externalUrl)
    const image =
      (fullUrl !== externalUrl ? (await downloadImage(fullUrl)).image : null) ?? (await fetchImage(externalUrl))
    if (!image) return null

    const { bytes, contentType, ext } = image
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

// The key ends before the `?v=` cache buster the cover scripts append.
export function extractStoragePath(imageUrl: string): string | null {
  const match = imageUrl.match(/\/storage\/v1\/object\/public\/recipe-images\/([^?#]+)/)
  return match ? match[1] : null
}

// An image_url that archiving never replaced still points at the source
// host. The Worker-side image optimizer fetches from the same place the
// archive did, so when that host refuses Cloudflare, the optimized <Image>
// renders nothing. Such covers are served unoptimized, straight from the
// host, which is where the browser can still reach them.
export function isArchivedImageUrl(imageUrl: string): boolean {
  return extractStoragePath(imageUrl) != null
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
// Page chrome the markup itself flags as non-content, never a photo of the
// dish: an image marked purely decorative (`role="presentation"`/`"none"`) or
// hidden from the accessibility tree (`aria-hidden="true"`). pysznosci.pl
// (Wirtualna Polska) renders a `role="presentation"` spinner per lightbox slot
// and an `aria-hidden` flame icon in its exit-intent popup — both carry no
// dimensions, so the size gates would otherwise let them into the gallery.
const DECORATIVE_RE = /\brole=["'](?:presentation|none)["']|\baria-hidden=["']true["']/i
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
 * order: ads, tracking pixels, icons and decorative lightbox chrome are
 * dropped, relative URLs are resolved against `base`, and an `<img>` that
 * merely links back to the page it sits on is dropped too.
 */
function photoTags(html: string, base: URL | undefined): ImageTag[] {
  const tags: ImageTag[] = []
  // The page's own URL (fragment stripped), so a lightbox placeholder whose src
  // is the article itself (pysznosci.pl's `wpl-image`) is dropped: never a
  // photo, and its "file name" — the page slug — would otherwise score it as
  // the best cover.
  const selfHref = base?.href.split('#')[0]
  for (const tag of html.match(/<img\b[^>]+>/gi) ?? []) {
    const m = ATTR_RE.exec(tag)
    const raw = m?.[1] ?? m?.[2] ?? m?.[3]
    if (!raw || NOT_A_PHOTO_RE.test(raw) || AD_CLASS_RE.test(tag) || DECORATIVE_RE.test(tag)) continue

    let url = raw
    if (base) {
      try {
        url = new URL(raw, base).href
      } catch {
        continue
      }
      if (url.split('#')[0] === selfHref) continue
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
  const slugWords = slugWordsOf(base)

  let best: { url: string; score: number } | undefined
  for (const { url, tag, width, height } of photoTags(html, base)) {
    // A missing width/height parses to NaN, which fails both comparisons, so
    // only images that declare a small size are dropped.
    if (width < 100 || height < 100) continue

    let score = 0
    if (ITEMPROP_IMAGE_RE.test(tag)) score += 100
    const imageWords = new Set([...fileWords(url), ...words(ALT_RE.exec(tag)?.[1] ?? '')])
    if ([...imageWords].some((w) => slugWords.has(w))) score += 20
    if (width >= 300 || height >= 300) score += 5

    if (!best || score > best.score) best = { url, score }
  }
  return best?.url
}

/** The 4+ letter words in a URL's file name — `szaszlyki`, `przepis` from
 *  `.../szaszlyki-z-piekarnika-przepis-2.jpg`. */
function fileWords(url: string): Set<string> {
  return words(url.split(/[?#]/)[0].split('/').pop() ?? '')
}

/** The distinctive 4+ letter words of a page's URL path — its dish name. */
function slugWordsOf(base: URL | undefined): Set<string> {
  return base ? words(base.pathname) : new Set<string>()
}

// The `-696x464` (optionally `-v-360x360`) suffix of a WordPress resize, before
// the extension. Shared so the full-size recovery and photoKey's identity strip
// stay in step.
const WP_RESIZE_SUFFIX_RE = /(-v)?[-_]\d{2,4}x\d{2,4}(?=\.\w+(?:[?#]|$))/

// Best-effort, Polish-primary stopwords: words that sit in a recipe slug and in
// most of a site's file names alike, so they don't tell one dish from another —
// only the distinctive words do. Not exhaustive; a missed word only makes the
// stale-og override below slightly less likely to fire.
const GENERIC_SLUG_WORDS = new Set([
  'przepis', 'przepisy', 'recipe', 'domowy', 'domowa', 'domowe', 'domowej',
  'najlepszy', 'najlepsza', 'najlepsze', 'prawdziwy', 'prawdziwa', 'prawdziwe',
  'szybki', 'szybka', 'szybkie', 'latwy', 'latwa', 'latwe', 'klasyczny', 'pyszny', 'pyszne',
  'easy', 'best', 'homemade', 'quick', 'simple', 'classic',
])

// WordPress serves a `-696x464` resize of an uploaded photo; the full-size
// original — the suffix removed — is generated from it, so archiveImage prefers
// it but falls back to the resize URL when it is missing or over the size cap.
function fullSizeImageUrl(url: string): string {
  return url.replace(WP_RESIZE_SUFFIX_RE, '')
}

/** Whether the file name carries any distinctive (non-generic) slug word. */
function sharesDistinctiveWord(url: string, slugWords: Set<string>): boolean {
  for (const w of fileWords(url)) if (slugWords.has(w) && !GENERIC_SLUG_WORDS.has(w)) return true
  return false
}

export const LD_JSON_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
// Nodes whose schema.org image is the dish, best first: the recipe's own, then
// the article's; a WebPage's primary image is a weaker last resort.
const LD_IMAGE_TYPES = [/recipe/i, /article|blogposting/i, /webpage/i]

/** The first URL in a schema.org `image` value — a string, an ImageObject, or
 *  an array of either. Kept as found (absolute or page-relative); jsonLdImage
 *  resolves it against the page. */
function ldImageHref(image: unknown): string | undefined {
  for (const value of Array.isArray(image) ? image : [image]) {
    const href = typeof value === 'string' ? value : (value as { url?: unknown } | null)?.url
    if (typeof href === 'string' && href.trim()) return href.trim()
  }
  return undefined
}

/** The @type of a JSON-LD node as a lower-case string, however it is spelled. */
export function ldType(node: { '@type'?: unknown }): string {
  const type = node['@type']
  return (Array.isArray(type) ? type.join(' ') : typeof type === 'string' ? type : '').toLowerCase()
}

/**
 * The dish photo a page declares in its schema.org JSON-LD, resolved against
 * `base`. Many WordPress recipe blogs (marta-gotuje.pl) ship no og:image at
 * all and name the photo only here, so it is the cover when the og:image and
 * the in-content scan come up empty. The Recipe node's image wins over an
 * Article's over a WebPage's; a logo or author avatar under some other node is
 * ignored.
 */
export function jsonLdImage(html: string, pageUrl?: string): string | undefined {
  const base = parseBase(pageUrl)
  const found: string[] = ['', '', ''] // one slot per LD_IMAGE_TYPES rank
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    const href = ldImageHref(record.image)
    if (href) {
      const rank = LD_IMAGE_TYPES.findIndex((re) => re.test(ldType(record)))
      if (rank >= 0 && !found[rank]) found[rank] = href
    }
    for (const value of Object.values(record)) if (value && typeof value === 'object') visit(value)
  }
  for (const [, body] of html.matchAll(LD_JSON_RE)) {
    try {
      visit(JSON.parse(body.trim()))
    } catch {
      // A malformed block just contributes no candidate.
    }
  }
  const best = found.find(Boolean)
  if (!best) return undefined
  try {
    return new URL(best, base).href
  } catch {
    return undefined
  }
}

/**
 * The per-step photos a page declares in its schema.org Recipe JSON-LD
 * (`recipeInstructions` → `HowToStep.image`), resolved against `pageUrl`, one
 * entry per step in source order ('' where a step has no image). HowToSection
 * groups are flattened; a plain-string step yields ''. This is the deterministic
 * source of step photos (ZMIANA zdjęcia kroków) — index-aligned with the source's
 * own steps; the caller aligns it to the (LLM-cleaned) stored steps by position.
 */
export function jsonLdHowToStepImages(html: string, pageUrl?: string): string[] {
  const base = parseBase(pageUrl)
  const stepImage = (node: Record<string, unknown>): string => {
    const href = ldImageHref(node.image)
    if (!href) return ''
    try {
      return new URL(href, base).href
    } catch {
      return ''
    }
  }
  // recipeInstructions: an array of HowToStep | HowToSection | string, a single
  // HowToStep/HowToSection, or a plain string (the whole method, no per-step image).
  const flatten = (instructions: unknown): string[] => {
    if (Array.isArray(instructions)) return instructions.flatMap(flatten)
    if (!instructions || typeof instructions !== 'object') return instructions ? [''] : []
    const node = instructions as Record<string, unknown>
    if (ldType(node).includes('howtosection') && node.itemListElement != null) return flatten(node.itemListElement)
    return [stepImage(node)]
  }

  let steps: string[] = []
  const visit = (node: unknown): void => {
    if (steps.length > 0) return
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    if (ldType(record).includes('recipe') && record.recipeInstructions != null) {
      steps = flatten(record.recipeInstructions)
      if (steps.length > 0) return
    }
    for (const value of Object.values(record)) if (value && typeof value === 'object') visit(value)
  }
  for (const [, body] of html.matchAll(LD_JSON_RE)) {
    try {
      visit(JSON.parse(body.trim()))
    } catch {
      // A malformed block contributes no steps.
    }
    if (steps.length > 0) break
  }
  // Drop a trailing all-'' result (a single-string method, or no images at all):
  // nothing to align, and it saves the caller a length check against the steps.
  return steps.some(Boolean) ? steps : []
}

/**
 * The cover for a rendered blog page: the page's declared og:image, resolved
 * against the page when it is given relative. A misconfigured SEO plugin can
 * emit a stale site-wide og:image — the same unrelated photo on every post
 * (kulinarnapolska.org points them all at one "flaczki" image) — so when the
 * og:image shares none of the page's distinctive slug words while the best
 * in-content photo (taken outside the page's noise sections, so not a
 * related-recipe card) does, the in-content photo wins. The page's schema.org
 * JSON-LD image stands in for a missing og:image (a blog that ships none) and
 * can likewise unseat a stale one. With none of the three, undefined.
 */
export function coverImage(ogImage: string | undefined, html: string, pageUrl?: string): string | undefined {
  const base = parseBase(pageUrl)
  let resolvedOg: string | undefined
  if (ogImage) {
    try {
      resolvedOg = new URL(ogImage, base).href
    } catch {
      resolvedOg = undefined
    }
  }

  const slugWords = slugWordsOf(base)
  const pageImage = pickRecipeImage(withoutNoiseSections(html), pageUrl)
  const ldImage = jsonLdImage(html, pageUrl)
  // A stale site-wide og:image (shares none of the page's distinctive slug
  // words) loses to a content image that does name the dish — the in-content
  // photo, else the schema.org image.
  const distinctive = [pageImage, ldImage].find((url) => url && sharesDistinctiveWord(url, slugWords))
  if (resolvedOg && distinctive && !sharesDistinctiveWord(resolvedOg, slugWords)) {
    return distinctive
  }
  return resolvedOg ?? pageImage ?? ldImage
}

/** Most photos a recipe keeps. A step-by-step post runs to about a dozen. */
export const GALLERY_LIMIT = 12

// Images inside a post that are still not the recipe's own photos: readers'
// photos under the comments, cards linking to other recipes, author badges.
const NOT_GALLERY_RE = /\bclass=["'][^"']*(comment|related|similar|recommend|popular|author|profile|avatar|widget)/i
// Readers' comment photos, and YouTube's video stills — a video is embedded
// on its own, and a still is no photo of the dish.
const NOT_GALLERY_URL_RE = /\/comments?\/|(^|\/\/)i\d?\.ytimg\.com\//i
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

// Wix: `/media/<file>/v1/<mode>/<size, quality, blur…>/<name>` — everything
// after the file is a rendition of it.
const WIX_HOST = 'static.wixstatic.com'
const WIX_RENDITION_RE = /^(\/media\/[^/]+)\/v1\/.*$/
// The rendition's size — a card or banner is rendered small. Not a blurred
// placeholder's (`blur_2`): that stands in for a full-width photo.
const WIX_SIZE_RE = /^\/media\/[^/]+\/v1\/[^/]+\/w_(\d+),h_(\d+)(?![^/]*\bblur_)/

/**
 * Wix renders post photos at the column width, and its raw html carries only
 * a blurred 147px placeholder; ask for a large rendition of the file instead.
 */
function wixFullSize(url: URL): string | null {
  const file = url.hostname === WIX_HOST ? WIX_RENDITION_RE.exec(url.pathname)?.[1] : undefined
  return file ? `${url.origin}${file}/v1/fit/w_1600,h_1600,q_85/${file.slice('/media/'.length)}` : null
}

// Symfony's LiipImagine: `/media/cache/<filter>/uploads/…` (or
// `/media/cache/resolve/<filter>/…`) is one upload rendered by a named filter;
// mojegotowanie.pl's og:image is `big`, the same photo in the post `default_big_format`.
const LIIP_FILTER_SEGMENT_RE = /\/media\/cache\/(?:resolve\/)?[^/]+\//

/**
 * Identity of a photo across its renditions — the same file at another size
 * or on another CDN edge (`scontent-waw2-1` vs `-2`) is one photo.
 */
function photoKey(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    return (hostname === WIX_HOST ? pathname.replace(WIX_RENDITION_RE, '$1') : pathname)
      .toLowerCase()
      .replace(LIIP_FILTER_SEGMENT_RE, '/')
      .replace(BLOGGER_SIZE_SEGMENT_RE, '/')
      .replace(WP_RESIZE_SUFFIX_RE, '')
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
// included — does not. Burda Media's shop-offer box (mojegotowanie.pl) hides
// behind obfuscated class names; only its `ecomm-boxd` wrapper and
// `discount-code` cards name it, and their shop logos are photo-sized.
const NOISE_SECTION_WORDS = new Set([
  'ad', 'ads', 'advert', 'advertisement', 'reklama', 'banner', 'sponsor', 'sponsored',
  'ecomm', 'discount',
  'related', 'similar', 'recommended', 'popular',
  'comment', 'comments', 'author', 'sidebar', 'widget', 'newsletter',
  'printfriendly',
])
const SECTION_OPEN_RE = /<(div|section|aside|nav|footer|ul|ol|li|figure|a|ins|span)\b[^>]*>/gi
const CLASS_OR_ID_RE = /\b(?:class|id)=["']([^"']*)["']/gi
// One open-or-close matcher per section tag name, built on first use.
const SAME_TAG_RES = new Map<string, RegExp>()

// A link a recipe photo may sit in: the photo's own file (lightbox, Blogger's
// full size) or its WordPress attachment page. An image linking anywhere else
// — a shop product, another recipe, a channel, the home page — is a promo.
const PHOTO_LINK_RE = /\.(jpe?g|png|webp|avif|gif)([?#]|$)|attachment|googleusercontent\.com|bp\.blogspot\.com/i
const HREF_RE = /\bhref=["']([^"']*)["']/i

function isNoiseSection(openTag: string): boolean {
  if (/^<a\b/i.test(openTag)) {
    const href = HREF_RE.exec(openTag)?.[1]
    if (href !== undefined && !PHOTO_LINK_RE.test(href)) return true
  }
  for (const [, value] of openTag.matchAll(CLASS_OR_ID_RE)) {
    if (value.split(/[\s_-]+/).some((w) => NOISE_SECTION_WORDS.has(w.toLowerCase()))) return true
  }
  return false
}

// The post body itself. A section holding it is page layout, not noise,
// whatever its class says: krysiagotuje wraps the whole post in
// `layout-right-sidebar`, and cutting that took every photo with it. Wix marks
// its post with `data-hook="post-description"`, inside a page wrapper whose
// breakpoint classes (`lte-banner-w980`) read as noise.
const POST_BODY_RE =
  /<main\b|\bitemprop=["']articleBody["']|\bdata-hook=["']post-description["']|\bclass=["'](?:[^"']*\s)?(?:entry-content|post-content|post-body)[\s"']/i

/**
 * The html with every noise section cut out, each up to its own closing tag.
 * A section whose closing tag is missing is left in — cutting to the end of
 * the page on broken markup could drop the recipe's own photos. So is one
 * that holds the post body; the noise inside it is still cut.
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
    if (end < 0 || POST_BODY_RE.test(html.slice(SECTION_OPEN_RE.lastIndex, end))) continue
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
    const fileSize =
      FILE_SIZE_RE.exec(parsed.pathname) ?? (parsed.hostname === WIX_HOST ? WIX_SIZE_RE.exec(parsed.pathname) : null)
    const side = fileSize
      ? Math.max(Number(fileSize[1]), Number(fileSize[2]))
      : Math.max(width, height)
    // NaN — no size anywhere — passes: most in-post photos declare none.
    if (side < MIN_GALLERY_SIDE) continue
    urls.push(wixFullSize(parsed) ?? url)
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

// Per-step photos share the gallery folder as `step-<n>.<ext>`.
const STEP_IMAGE_PREFIX = 'step-'

/**
 * Deletes the files in a recipe's gallery folder, except the storage paths in
 * `keep`. `keepStepImages` spares the per-step photos stored in the same folder:
 * a gallery refresh must not take them with it (it did, so every recipe whose
 * gallery was re-archived lost its step photos while step_images still pointed
 * at them). Deleting the recipe removes everything. Never throws.
 */
export async function removeGallery(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  keep: ReadonlySet<string> = new Set(),
  { keepStepImages = false }: { keepStepImages?: boolean } = {},
): Promise<void> {
  const folder = galleryFolder(userId, recipeId)
  const files = await listGallery(supabase, folder, 'removeGallery')
  const stale = files
    .filter((name) => !(keepStepImages && name.startsWith(STEP_IMAGE_PREFIX)))
    .map((name) => `${folder}/${name}`)
    .filter((path) => !keep.has(path))
  await removeImages(supabase, stale, 'removeGallery')
}

/** File names in a gallery folder; empty (and logged) when the listing fails. */
async function listGallery(supabase: SupabaseClient, folder: string, tag: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from('recipe-images').list(folder)
  if (error) {
    console.warn(`[${tag}] list failed: ${error.message}`)
    return []
  }
  return (data ?? []).map((file) => file.name)
}

/**
 * Deletes everything a recipe has in Storage — the cover, the gallery and the
 * step photos — in one remove, for a recipe whose row is already gone. Never throws.
 */
export async function removeRecipeImages(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  coverUrl: string | null,
): Promise<void> {
  const folder = galleryFolder(userId, recipeId)
  const cover = coverUrl ? extractStoragePath(coverUrl) : null
  const gallery = (await listGallery(supabase, folder, 'removeRecipeImages')).map((name) => `${folder}/${name}`)
  await removeImages(supabase, cover ? [cover, ...gallery] : gallery, 'removeRecipeImages')
}

/**
 * Removes `paths` from the recipe-images bucket and logs when any of them is
 * still there afterwards, and returns those. Storage answers a delete that row-level security
 * filters out with `data: []` and no error (#132: covers outlived their
 * recipes for months with nothing in the logs), so the count of removed
 * objects is checked, not only the error. Never throws.
 */
export async function removeImages(supabase: SupabaseClient, paths: string[], tag: string): Promise<string[]> {
  if (paths.length === 0) return []
  const { data, error } = await supabase.storage.from('recipe-images').remove(paths)
  if (error) {
    console.warn(`[${tag}] remove failed: ${error.message}`)
    return paths
  }
  const removed = new Set((data ?? []).map((file) => file.name))
  const left = paths.filter((path) => !removed.has(path))
  if (left.length > 0) console.warn(`[${tag}] removed ${removed.size} of ${paths.length}; still stored: ${left.join(', ')}`)
  return left
}

/**
 * The recipe an object belongs to, read from its key: the cover
 * `<user>/<recipe>.<ext>` or a gallery/step photo in `galleryFolder`.
 * Null for a key that fits neither, which a sweep must leave alone.
 */
export function recipeIdOfImage(path: string): number | null {
  const match = path.match(/^[^/]+\/(\d+)(?:\.[a-z0-9]+|\/[^/]+)$/i)
  return match ? Number(match[1]) : null
}

/**
 * Keys whose recipe no longer exists: images left behind by deletes that ran
 * before the bucket had an owner delete policy (#132). Recipe ids are global,
 * so the owner folder is not compared; a recipe that changed owner keeps its
 * files. Keys that do not name a recipe are never returned.
 */
export function orphanedImagePaths(paths: Iterable<string>, liveRecipeIds: ReadonlySet<number>): string[] {
  const orphans: string[] = []
  for (const path of paths) {
    const id = recipeIdOfImage(path)
    if (id != null && !liveRecipeIds.has(id)) orphans.push(path)
  }
  return orphans
}

/**
 * Archives the gallery as `<user>/<recipe>/<run>-<n>.<ext>` and returns the
 * Storage URLs of the photos that made it, in order. Photos that fail to
 * download are left out rather than kept as external links: Facebook's expire
 * within days. `archivedCover` stands in for `sources[0]`, which buildGallery
 * makes the cover, so it is not downloaded twice.
 *
 * Returns null when there were photos but none of them archived: the caller
 * keeps the gallery it has, and its files are left alone. The old files are
 * removed only once a new set exists; `<run>` keeps the new names from
 * overwriting them (and a cached old photo from showing under a new URL).
 */
export async function archiveGallery(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  sources: string[],
  archivedCover: string | null,
): Promise<string[] | null> {
  const folder = galleryFolder(userId, recipeId)
  const run = Date.now().toString(36)
  const archived = await Promise.all(
    sources.map((source, i) =>
      i === 0 && archivedCover ? archivedCover : archiveImageAt(supabase, `${folder}/${run}-${i}`, source),
    ),
  )
  const gallery = archived.filter((url): url is string => url != null)
  const kept = new Set(
    gallery.map((url) => extractStoragePath(url)).filter((path): path is string => path?.startsWith(`${folder}/`) ?? false),
  )
  if (sources.length > 0 && kept.size === 0) return null

  // A refresh may find fewer photos than last time; stale files must not linger.
  // The step photos beside them are archived in parallel and are not ours to drop.
  await removeGallery(supabase, userId, recipeId, kept, { keepStepImages: true })
  return gallery
}

/**
 * Archives per-step source photos into Storage at `<user>/<recipe>/step-<n>`,
 * returning a list index-aligned with the steps: the Storage URL where that step
 * had a downloadable photo, '' otherwise (a null source, or a failed download —
 * never a hotlink). Returns `[]` when no step has a source, so callers can run it
 * unconditionally.
 */
export async function archiveStepImages(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  sources: readonly (string | null)[],
): Promise<string[]> {
  if (!sources.some(Boolean)) return []
  const folder = galleryFolder(userId, recipeId)
  const archived = await Promise.all(
    sources.map((source, i) =>
      source ? archiveImageAt(supabase, `${folder}/${STEP_IMAGE_PREFIX}${i}`, source) : Promise.resolve(null),
    ),
  )
  return archived.map((url) => url ?? '')
}

/**
 * Archives a recipe's cover and gallery. The gallery is only touched when
 * there is one, or when `clearStale` asks for an old one to be emptied (a
 * refresh replaces the gallery outright). `gallery` is null when the photos
 * failed to archive, and the stored gallery must be kept.
 */
export async function archiveRecipeImages(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  cover: string | undefined,
  gallery: string[],
  { clearStale = false }: { clearStale?: boolean } = {},
): Promise<{ cover: string | null; gallery: string[] | null }> {
  const archivedCover = cover != null ? await archiveImage(supabase, userId, recipeId, cover) : null
  const archivedGallery =
    gallery.length > 0 || clearStale
      ? await archiveGallery(supabase, userId, recipeId, gallery, archivedCover)
      : []
  return { cover: archivedCover, gallery: archivedGallery }
}
