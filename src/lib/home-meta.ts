import type { Metadata } from 'next'

/**
 * The homepage title and description (the SEO copy from #471) and the social
 * card built from them. Kept here, out of `layout.tsx` and `page.tsx`, so the
 * root metadata (the <title>/<meta description>) and the homepage's Open
 * Graph + Twitter tags share one source of truth — and so the card builder
 * stays a pure, node-testable unit.
 */
export const HOME_TITLE = 'Zapisz Przepis — Twój zbiór przepisów z internetu'
export const HOME_DESCRIPTION =
  'Twoje ulubione przepisy z internetu, zebrane w jednym miejscu. Wklej link, a przepis od razu trafi do Twojej kolekcji — gotowy, gdy przyjdzie ochota na gotowanie.'

/** The one site-level social image: a 1200×630 card at /og/home.jpg. */
const OG_IMAGE_PATH = '/og/home.jpg'

/**
 * Open Graph + Twitter card for the homepage (#472). `siteUrl` is the absolute
 * origin (from `getSiteUrl()`): the root layout sets no `metadataBase`, so a
 * relative og:image would not resolve for the scrapers that build link
 * previews. `summary_large_image` shows the 1200×630 card full-width.
 */
export function homeMetadata(siteUrl: string): Metadata {
  const ogImage = `${siteUrl}${OG_IMAGE_PATH}`
  return {
    openGraph: {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      type: 'website',
      url: siteUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: HOME_TITLE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      images: [ogImage],
    },
  }
}
