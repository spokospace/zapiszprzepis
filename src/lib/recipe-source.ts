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
 * that. A known Facebook author is named before the platform ("Kulinarna
 * Wiola · Facebook"). Falls back to "Blog" / "Inny" when the URL is missing
 * or unparseable.
 */
export function sourceLabel(sourceType: RecipeSource, sourceUrl: string | null): string {
  const platform = PLATFORM_LABELS[sourceType]
  if (platform) {
    const author = sourceUrl ? facebookAuthorName(sourceUrl) : null
    return author ? `${author} · ${platform}` : platform
  }
  if (sourceUrl) {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      // Not a URL — fall through to the generic label.
    }
  }
  return sourceType === 'web_blog' ? 'Blog' : 'Inny'
}
