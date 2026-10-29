import type { ReactNode } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { recipePath } from '@/lib/routes'
import { loadRecipe } from './load-recipe'
import { findMergedRecipeSlug } from './merged-redirect'

/**
 * Answers a missing recipe with a real 404 (#227). loading.tsx streams the skeleton
 * as soon as rendering reaches it, and the status cannot change once streaming has
 * started, so the existence check runs here, above it. The lookup is the page's own
 * (React cache()), so this adds no query. In-app navigation still shows the skeleton
 * at once: a prefetch renders this layout ahead of the click.
 *
 * A link to a duplicate since folded into another recipe redirects there
 * (308) instead — decided here for the same reason, before streaming starts.
 */
export default async function RecipeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { recipe, error, hidden } = await loadRecipe(slug)
  // A hidden recipe its owner or a favoriter asks for renders the "unavailable" page, not a 404.
  if (hidden?.kind === 'unavailable') return children
  if (error || !recipe) {
    if (error) console.error('[recipe] Query error:', error)
    const mergedInto = error ? null : await findMergedRecipeSlug(slug)
    if (mergedInto) permanentRedirect(recipePath(mergedInto))
    notFound()
  }
  return children
}
