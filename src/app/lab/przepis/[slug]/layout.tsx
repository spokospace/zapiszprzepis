import type { ReactNode } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPublicRecipeLongLived } from '@/lib/recipe-cache'
import { findMergedRecipeSlug } from '@/app/przepis/[slug]/merged-redirect'

/** The real layout's 404 and merged-slug redirect, without the session (spec A proof). */
export default async function RecipeLabLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const recipe = await getPublicRecipeLongLived(slug)
  if (!recipe) {
    const mergedInto = await findMergedRecipeSlug(slug)
    if (mergedInto) permanentRedirect(`/lab/przepis/${mergedInto}`)
    notFound()
  }
  return children
}
