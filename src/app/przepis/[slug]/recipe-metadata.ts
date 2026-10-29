import type { Metadata } from 'next'
import { buildFallbackMetaDescription } from '@/lib/recipe-tags'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'
import { OG_SITE, SITE_NAME } from '@/lib/site'
import type { RecipeForJsonLd } from '@/lib/recipe-json-ld'

/**
 * The recipe page's <title>, description, canonical and social card. Crawlers and
 * link-preview bots are anonymous, so it describes what a guest sees.
 */
export function recipeMetadata(recipe: RecipeForJsonLd, siteUrl: string): Metadata {
  const description = recipe.meta_description ?? buildFallbackMetaDescription(recipe)
  // og:image/twitter only from an archived Storage cover — never a legacy external
  // link (the image_url invariant), so no third-party URL lands in the page's meta.
  // No width/height: covers keep whatever size the source had, and none is stored.
  const cover = coverImageSrc(recipe.image_url)
  const images = cover ? [{ url: cover, alt: recipe.title }] : undefined
  const canonical = `${siteUrl}${recipePath(recipe.slug)}`
  return {
    // The site name after the dish, as on the category pages; og:title stays the dish alone.
    title: `${recipe.title} · ${SITE_NAME}`,
    description,
    // ?from= list-context variants (E01-S07) must not compete with the canonical URL.
    // Absolute: the root layout sets no metadataBase, so a relative canonical would
    // resolve against Next's localhost fallback in production.
    // The .md alternate (#363) advertises the AI-citable Markdown rendering.
    alternates: { canonical, types: { 'text/markdown': `${canonical}.md` } },
    openGraph: {
      title: recipe.title,
      description,
      type: 'article',
      url: canonical,
      ...OG_SITE,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: recipe.title,
      description,
    },
  }
}
