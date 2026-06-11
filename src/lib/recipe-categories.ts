import type { Database } from '@/lib/supabase.types'

export type RecipeCategory = Database['public']['Enums']['recipe_category']

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'obiady', label: 'Obiady' },
  { value: 'zupy', label: 'Zupy' },
  { value: 'desery', label: 'Desery' },
  { value: 'sniadania', label: 'Śniadania' },
  { value: 'przekaski', label: 'Przekąski' },
  { value: 'wegetarianskie', label: 'Wegetariańskie' },
  { value: 'napoje', label: 'Napoje' },
  { value: 'inne', label: 'Inne' },
]
