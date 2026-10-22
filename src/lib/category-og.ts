import type { RecipeCategory } from './recipe-categories'

/**
 * The per-category social card: a 1200×630 image at
 * public/og/categories/<value>.jpg, one per recipe category. Returned as a
 * site-root-relative path; the page makes it absolute with `getSiteUrl()`,
 * since the root layout sets no `metadataBase`. Every RecipeCategory has a
 * committed card (guarded by category-og.test.ts).
 */
export function categoryOgImagePath(category: RecipeCategory): string {
  return `/og/categories/${category}.jpg`
}
