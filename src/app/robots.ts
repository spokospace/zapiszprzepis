import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'
import { NOTIFICATIONS_PATH, ADD_RECIPE_PATH } from '@/lib/routes'

/**
 * /robots.txt — allow crawlers across the public site, keep them out of the
 * authenticated app, the API, the auth screens and parametrized search results
 * (thin/duplicate), and point them at the sitemap. The disallow list is the
 * complement of isPublicRoute (src/lib/routes.ts): everything a guest can't open
 * anyway, plus /szukaj's query permutations. Phase 1 of the sitemap spec (#363).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/recipes', // "Moje przepisy" — owner-only
        '/ulubione',
        NOTIFICATIONS_PATH,
        '/settings',
        ADD_RECIPE_PATH,
        '/witaj',
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/auth/',
        '/share',
        '/szukaj?', // search result permutations; the bare /szukaj stays allowed
      ],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
