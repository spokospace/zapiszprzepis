import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'
import { listCanonicalRecipes, listPublicProfileUsernames } from '@/lib/public-recipe'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { recipePath, categoryPath, profilePath, SEARCH_PATH, LEGAL_PATHS } from '@/lib/routes'

/** Edge-cache the sitemap for an hour so crawlers hit cache, not the Worker/DB. */
export const revalidate = 3600

/**
 * /sitemap.xml — every public URL: the home page, each canonical recipe
 * (/przepis/{slug}, deduped oldest-wins), each category listing, each public
 * profile (/u/{username}), and the legal pages. If the DB read fails the static
 * set is still returned, so a transient error never drops the whole sitemap.
 * Phase 1 of the sitemap spec (#363).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteUrl()
  const url = (path: string) => `${site}${path}`

  const staticEntries: MetadataRoute.Sitemap = [
    { url: url('/'), changeFrequency: 'daily', priority: 1 },
    { url: url(SEARCH_PATH), changeFrequency: 'weekly', priority: 0.3 },
    ...RECIPE_CATEGORIES.map((c) => ({
      url: url(categoryPath(c.value)),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...LEGAL_PATHS.map((path) => ({
      url: url(path),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ]

  try {
    const [recipes, usernames] = await Promise.all([
      listCanonicalRecipes(),
      listPublicProfileUsernames(),
    ])
    const recipeEntries: MetadataRoute.Sitemap = recipes.map((r) => ({
      url: url(recipePath(r.slug)),
      lastModified: new Date(r.lastModified),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
    const profileEntries: MetadataRoute.Sitemap = usernames.flatMap((username) => {
      const path = profilePath(username)
      return path ? [{ url: url(path), changeFrequency: 'weekly' as const, priority: 0.4 }] : []
    })
    return [...staticEntries, ...recipeEntries, ...profileEntries]
  } catch {
    // DB unreachable: keep a valid sitemap of the static public pages rather
    // than 500, which would make crawlers drop the sitemap entirely.
    return staticEntries
  }
}
