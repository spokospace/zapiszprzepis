import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { loadRecipe } from './load-recipe'

/**
 * Answers a missing recipe with a real 404 (#227). loading.tsx streams the skeleton
 * as soon as rendering reaches it, and the status cannot change once streaming has
 * started, so the existence check runs here, above it. The lookup is the page's own
 * (React cache()), so this adds no query. In-app navigation still shows the skeleton
 * at once: a prefetch renders this layout ahead of the click.
 */
export default async function RecipeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { recipe, error } = await loadRecipe(slug)
  if (error || !recipe) {
    if (error) console.error('[recipe] Query error:', error)
    notFound()
  }
  return children
}
