import {
  Cake,
  CakeSlice,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  GlassWater,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { bindOrphans } from './polish-typography'
import type { Database } from '@/lib/supabase.types'

export type RecipeCategory = Database['public']['Enums']['recipe_category']

/**
 * A category label ready for display: binds Polish one-letter words so they never
 * end a line (see bindOrphans — "Syropy i napary" → "Syropy" / "i napary"). Use it
 * for every rendered category name (the drawer, the home grid) so the rule lives in
 * one place; keep the raw `label` / `categoryLabel` for enum matching, SEO and
 * markdown, where a non-breaking space must not leak in.
 */
export function categoryDisplayLabel(label: string): string {
  return bindOrphans(label)
}

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

/**
 * The tile icon per category (handoff C1/A1): the prototypes' lucide names
 * where they give one, the closest lucide glyph for the rest. Always shown
 * next to the label, never alone, so they are decorative (`aria-hidden`).
 */
export const CATEGORY_ICONS: Record<RecipeCategory, LucideIcon> = {
  obiady: Utensils,
  zupy: Soup,
  desery: CakeSlice,
  ciasta: Cake,
  ciasteczka: Cookie,
  sniadania: Coffee,
  pieczywo: Croissant,
  przekaski: Sandwich,
  salatki: Salad,
  napoje: GlassWater,
  syropy: CupSoda,
  inne: UtensilsCrossed,
}

/** Narrows a URL segment or query value to an enum member. */
export function isRecipeCategory(value: string): value is RecipeCategory {
  return RECIPE_CATEGORIES.some((c) => c.value === value)
}

/**
 * The categories the home page shows (E01-S04, 8 tiles): the first eight in
 * RECIPE_CATEGORIES order. Reorder RECIPE_CATEGORIES to change them.
 */
export const HOME_CATEGORIES = RECIPE_CATEGORIES.slice(0, 8)
