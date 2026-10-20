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
