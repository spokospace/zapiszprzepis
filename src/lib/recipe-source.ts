import type { Database } from '@/lib/supabase.types'
import { facebookAuthorName } from '@/lib/facebook-authors'

export type RecipeSource = Database['public']['Enums']['recipe_source']

const PLATFORM_LABELS: Partial<Record<RecipeSource, string>> = {
  facebook_text: 'Facebook',
  facebook_reel: 'Facebook',
  youtube: 'YouTube',
}

/**
 * Where a recipe came from, as a reader would name it: the site's own domain
 * for a blog ("polskiekulinaria.pl") — two same-titled recipes from different
 * blogs are told apart by exactly that. For a Facebook recipe the badge's "f"
 * logo already names the platform, so the label is the author alone ("Kulinarna
 * Wiola"); YouTube stays "YouTube · {channel}". This is an owner decision that
 * overrides the "Facebook · {profil}" of the 2026-10-20 handoff (README §39) and
 * the older CLAUDE.md note — do not "restore" the "Facebook ·" prefix. The author
 * is the one stored at import, or for recipes saved before that, a known Facebook
 * author read off the URL; with no author a Facebook recipe shows the bare
 * "Facebook". Falls back to "Blog" / "Inny" when the URL is missing or unparseable.
 */
export function sourceLabel(
  sourceType: RecipeSource,
  sourceUrl: string | null,
  sourceAuthor: string | null = null,
): string {
  const platform = PLATFORM_LABELS[sourceType]
  if (platform) {
    const author = sourceAuthor || (sourceUrl ? facebookAuthorName(sourceUrl) : null)
    if (!author) return platform
    const name = trimAuthorTail(author)
    return isFacebookSource(sourceType) ? name : `${platform} · ${name}`
  }
  const web = sourceUrl ? webSource(sourceUrl) : null
  if (web) return web.name
  return sourceType === 'web_blog' ? 'Blog' : 'Inny'
}

/**
 * Trims a trailing marketing descriptor from a Facebook/YouTube author or channel
 * name so the source badge stays short (#413): a tail after a space-padded dash,
 * "Mikołaj Drożdżyński - Z Pasją do Gotowania" → "Mikołaj Drożdżyński". Kept
 * conservative — the dash must have a space on both sides, so hyphenated or compact
 * names ("Smaki Katriny-najlepsze przepisy", "Alex & Cris P") are left alone, and
 * the kept head must still carry real content (≥ 3 chars).
 */
function trimAuthorTail(name: string): string {
  const head = name.split(/\s[-–—]\s/)[0].trim()
  return head.length >= 3 ? head : name
}

/** Which icon the source badge shows (2026-10-20 handoff §1). `website` is the
 *  generic globe; `wordpress` / `blogger` mark a recipe hosted on those blogging
 *  platforms. `book` and `person` are kept for the future page-less recipes (a
 *  cookbook or a person) the handoff names. */
export type SourceKind = 'website' | 'wordpress' | 'blogger' | 'youtube' | 'facebook' | 'book' | 'person'

/** The blog-platform badge icon a web source may carry; null keeps the globe. */
type BlogBrand = Extract<SourceKind, 'wordpress' | 'blogger'> | null

/** Facebook text post or reel — both carry the "f" badge and the author-only label. */
function isFacebookSource(sourceType: RecipeSource): boolean {
  return sourceType === 'facebook_text' || sourceType === 'facebook_reel'
}

export function sourceKind(sourceType: RecipeSource): SourceKind {
  if (sourceType === 'youtube') return 'youtube'
  if (isFacebookSource(sourceType)) return 'facebook'
  return 'website'
}

/**
 * The source badge's icon kind and the text a reader sees, from one place: the
 * card shows it on the photo (not a link — the whole card links to the recipe),
 * the recipe page shows the same as a link to the original (E01-S31). A recipe
 * from a multi-tenant blog host (blogspot.com, wordpress.com …) gets that
 * platform's icon.
 */
export function formatSource(
  sourceType: RecipeSource,
  sourceUrl: string | null,
  sourceAuthor: string | null = null,
): { kind: SourceKind; text: string } {
  const text = sourceLabel(sourceType, sourceUrl, sourceAuthor)
  const base = sourceKind(sourceType)
  if (base === 'website' && sourceUrl) {
    const brand = webSource(sourceUrl)?.brand
    if (brand) return { kind: brand, text }
  }
  return { kind: base, text }
}

/** The platform in the locative, for "Otwórz oryginał na {…}" (design handoff C3, item 11). */
const PLATFORM_LOCATIVE: Partial<Record<RecipeSource, string>> = {
  facebook_text: 'Facebooku',
  facebook_reel: 'Facebooku',
  youtube: 'YouTube',
}

/**
 * The bottom "Otwórz oryginał" button's label: "na YouTube" / "na Facebooku" for
 * a platform, "na aniagotuje.pl" for a site, plain "Otwórz oryginał" when the
 * URL does not parse.
 */
export function originalLinkLabel(sourceType: RecipeSource, sourceUrl: string): string {
  const platform = PLATFORM_LOCATIVE[sourceType]
  const where = platform ?? webSource(sourceUrl)?.name
  return where ? `Otwórz oryginał na ${where}` : 'Otwórz oryginał'
}

/**
 * Multi-tenant blog hosts where the subdomain is the blog, not the platform. On
 * these the full host ("agusiowesmakolyki.blogspot.com") is too long for a card
 * badge, so the reader sees just the blog's own name ("agusiowesmakolyki") —
 * still enough to tell two blogs on the same platform apart. Each `domain` is the
 * platform part anchored at the host's end; `brand` picks the badge icon, `null`
 * keeps the generic globe. The blogspot pattern covers every TLD (foo.blogspot.de,
 * foo.blogspot.co.uk …), mirroring `isBlogspotUrl` in blogger-feed.ts so a blog's
 * label and icon never disagree with how the importer classified its host.
 */
const BLOG_PLATFORMS: { domain: RegExp; brand: BlogBrand }[] = [
  { domain: /\.blogspot\.[a-z]{2,}(\.[a-z]{2,})?$/i, brand: 'blogger' },
  { domain: /\.wordpress\.com$/i, brand: 'wordpress' },
  { domain: /\.home\.blog$/i, brand: 'wordpress' },
  { domain: /\.weebly\.com$/i, brand: null },
]

/**
 * The reader-facing name of a web source and its platform brand, from a URL. The
 * host without "www."; on a known multi-tenant host, just the blog's subdomain
 * label. Null when the URL does not parse.
 */
function webSource(url: string): { name: string; brand: BlogBrand } | null {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  for (const { domain, brand } of BLOG_PLATFORMS) {
    const match = domain.exec(host)
    // match.index is the dot before the platform domain; > 0 means a real
    // subdomain label precedes it (a bare "blogspot.com" host keeps its name).
    if (match && match.index > 0) return { name: host.slice(0, match.index), brand }
  }
  return { name: host, brand: null }
}
