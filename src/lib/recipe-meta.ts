import { categoryLabel } from './recipe-categories'
import { formatMinutes } from './format-minutes'

interface RecipeTimes {
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
}

/** Total time for the header: the stated total, else prep + cook, else null. */
export function recipeTotalMinutes(r: RecipeTimes): number | null {
  if (r.total_time_minutes != null) return r.total_time_minutes
  if (r.prep_time_minutes == null && r.cook_time_minutes == null) return null
  return (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0)
}

/**
 * The recipe header's "Kategoria · czas" line (E01-S07). "≈" marks an estimated
 * time; with no known time the line is just the category.
 */
export function recipeMetaLine(r: RecipeTimes & { category: string; times_estimated: boolean }): string {
  const minutes = recipeTotalMinutes(r)
  const category = categoryLabel(r.category)
  if (minutes == null || minutes <= 0) return category
  return `${category} · ${r.times_estimated ? '≈ ' : ''}${formatMinutes(minutes)}`
}
