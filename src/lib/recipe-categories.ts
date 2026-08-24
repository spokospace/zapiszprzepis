import type { Database } from '@/lib/supabase.types'

export type RecipeCategory = Database['public']['Enums']['recipe_category']

/**
 * Display label for a category value. The enum values are ASCII slugs
 * (`salatki`, `przekaski`) while the labels carry the Polish diacritics
 * (`Sałatki`, `Przekąski`), so anything user-facing MUST go through here —
 * rendering the raw value drops the diacritics and reads as a typo.
 *
 * Falls back to the raw value so an enum member added in a migration before
 * it is added here degrades to something readable instead of blank.
 */
export function categoryLabel(value: string): string {
  return RECIPE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'obiady', label: 'Obiady' },
  { value: 'zupy', label: 'Zupy' },
  { value: 'desery', label: 'Desery' },
  { value: 'sniadania', label: 'Śniadania' },
  { value: 'przekaski', label: 'Przekąski' },
  { value: 'salatki', label: 'Sałatki' },
  { value: 'napoje', label: 'Napoje' },
  { value: 'inne', label: 'Inne' },
]
