import type { Database } from '@/lib/supabase.types'

/**
 * „Moje przepisy” (/recipes): only what a card shows (#229). The list renders on
 * the server, so the cards reach the browser as HTML, without their code or a
 * second copy of every row as props.
 */
export type MyRecipeCard = Pick<
  Database['public']['Tables']['recipes']['Row'],
  'id' | 'slug' | 'title' | 'image_url' | 'category' | 'description' | 'source_type' | 'source_url' | 'source_author'
>

/** The columns behind MyRecipeCard, for the page's select. */
export const MY_RECIPE_CARD_COLUMNS = 'id, slug, title, image_url, category, description, source_type, source_url, source_author'

/** „Pokaż kolejne” step on „Moje przepisy” (#230): fills the 1/2/3-column grid evenly. */
export const MY_RECIPES_PAGE_SIZE = 24

/** `?strona=` cap: the list is read from the top, and PostgREST answers at most 1000 rows. */
export const MY_RECIPES_MAX_PAGE = Math.floor(1000 / MY_RECIPES_PAGE_SIZE)

/** „Moje przepisy” with the visitor's filters and how far they had read (`strona` > 1 only). */
export function myRecipesHref(category?: string | null, tag?: string | null, page = 1): string {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (tag) params.set('tag', tag)
  if (page > 1) params.set('strona', String(page))
  const query = params.toString()
  return query ? `/recipes?${query}` : '/recipes'
}

