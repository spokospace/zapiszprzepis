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

/** Lowercase ASCII form: `Sałatki ` → `salatki`. `ł` has no NFD decomposition. */
function foldCategory(text: string): string {
  return text.trim().toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * The enum value for a category the LLM returned. The model is told the
 * values but still answers with a label (`Sałatki`), a diacritic slug
 * (`sałatki`) or an off-list guess (`kolacje`) — and Postgres rejects anything
 * outside the enum, throwing the whole extraction away. A label or slug in any
 * casing maps to its value; anything else becomes `inne`, which the user can
 * re-categorise. Returns `coerced: true` for that fallback so it can be logged.
 */
export function toRecipeCategory(raw: unknown): { category: RecipeCategory; coerced: boolean } {
  const folded = typeof raw === 'string' ? foldCategory(raw) : ''
  const match = RECIPE_CATEGORIES.find((c) => c.value === folded || foldCategory(c.label) === folded)
  return match ? { category: match.value, coerced: false } : { category: 'inne', coerced: true }
}

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'obiady', label: 'Obiady' },
  { value: 'zupy', label: 'Zupy' },
  { value: 'desery', label: 'Desery' },
  { value: 'ciasta', label: 'Ciasta' },
  { value: 'ciasteczka', label: 'Ciasteczka' },
  { value: 'sniadania', label: 'Śniadania' },
  { value: 'pieczywo', label: 'Pieczywo' },
  { value: 'przekaski', label: 'Przekąski' },
  { value: 'salatki', label: 'Sałatki' },
  { value: 'napoje', label: 'Napoje' },
  { value: 'syropy', label: 'Syropy i napary' },
  { value: 'inne', label: 'Inne' },
]

/** Narrows a URL segment or query value to an enum member. */
export function isRecipeCategory(value: string): value is RecipeCategory {
  return RECIPE_CATEGORIES.some((c) => c.value === value)
}

/**
 * The public listing of one category (E01-S09). Every "browse by category"
 * link goes through here, so moving the listing (e.g. onto `/szukaj`, E01-S05)
 * is a one-line change. Public on purpose: `/recipes?category=` is owner-only
 * and would bounce a guest to /login.
 */
export function categoryHref(value: RecipeCategory): string {
  return `/kategoria/${value}`
}
