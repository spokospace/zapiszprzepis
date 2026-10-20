import type { Database } from '@/lib/supabase.types'
import { facebookAuthorName } from '@/lib/facebook-authors'

export type RecipeSource = Database['public']['Enums']['recipe_source']

const PLATFORM_LABELS: Partial<Record<RecipeSource, string>> = {
  facebook_text: 'Facebook',
  facebook_reel: 'Facebook',
  youtube: 'YouTube',
}

/**
 * Where a recipe came from, as a reader would name it: the platform for
 * Facebook / YouTube, the site's own domain for a blog ("polskiekulinaria.pl")
 * — two same-titled recipes from different blogs are told apart by exactly
 * that. The platform comes first, then the author ("Facebook · Kulinarna
 * Wiola", "YouTube · Kuchnia Ani" — handoff C3 and CLAUDE.md): the one stored at import, or for recipes saved before that, a
 * known Facebook author read off the URL. Falls back to "Blog" / "Inny" when
 * the URL is missing or unparseable.
 */
export function sourceLabel(
  sourceType: RecipeSource,
  sourceUrl: string | null,
  sourceAuthor: string | null = null,
): string {
  const platform = PLATFORM_LABELS[sourceType]
  if (platform) {
    const author = sourceAuthor || (sourceUrl ? facebookAuthorName(sourceUrl) : null)
    return author ? `${platform} · ${author}` : platform
  }
  const host = sourceUrl ? siteHost(sourceUrl) : null
  if (host) return host
  return sourceType === 'web_blog' ? 'Blog' : 'Inny'
}

/** Which icon the source badge shows (2026-10-20 handoff §1). The current enum
 *  only yields website / youtube / facebook; `book` and `person` are kept for
 *  the future page-less recipes (a cookbook or a person) the handoff names. */
export type SourceKind = 'website' | 'youtube' | 'facebook' | 'book' | 'person'

export function sourceKind(sourceType: RecipeSource): SourceKind {
  if (sourceType === 'youtube') return 'youtube'
  if (sourceType === 'facebook_text' || sourceType === 'facebook_reel') return 'facebook'
  return 'website'
}

/**
 * The source badge's icon kind and the text a reader sees, from one place: the
 * card shows it on the photo (not a link — the whole card links to the recipe),
 * the recipe page shows the same as a link to the original (E01-S31).
 */
export function formatSource(
  sourceType: RecipeSource,
  sourceUrl: string | null,
  sourceAuthor: string | null = null,
): { kind: SourceKind; text: string } {
  return { kind: sourceKind(sourceType), text: sourceLabel(sourceType, sourceUrl, sourceAuthor) }
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
  const where = platform ?? siteHost(sourceUrl)
  return where ? `Otwórz oryginał na ${where}` : 'Otwórz oryginał'
}

/** The site's domain without "www.", or null when the URL does not parse. */
function siteHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
