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

/** The Polish plural form for `count`: `one` for 1, `few` for 2–4, 22–24, … (not
 *  12–14), `many` otherwise. */
export function polishPlural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one
  const last = count % 10
  const lastTwo = count % 100
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}

/** "1 zdjęcie", "2 zdjęcia", "5 zdjęć", "22 zdjęcia" — Polish plural (gallery teaser). */
export function photosLabel(count: number): string {
  return `${count} ${polishPlural(count, 'zdjęcie', 'zdjęcia', 'zdjęć')}`
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

export interface RecipeTimeStat {
  label: 'Przygotowanie' | 'Gotowanie' | 'Łącznie'
  /** "15 min", "1 godz 30 min". */
  value: string
}

/**
 * The desktop header's times row (handoff A9: "Przygotowanie / Gotowanie /
 * Łącznie"): only the known, positive times. "Łącznie" shows when the source
 * states a total or both parts are known, so it never just repeats the one part.
 * The recipe's single `times_estimated` flag covers the whole row.
 */
export function recipeTimeStats(r: RecipeTimes): RecipeTimeStat[] {
  const known = (m: number | null): m is number => m != null && m > 0
  const stats: RecipeTimeStat[] = []
  if (known(r.prep_time_minutes)) stats.push({ label: 'Przygotowanie', value: formatMinutes(r.prep_time_minutes) })
  if (known(r.cook_time_minutes)) stats.push({ label: 'Gotowanie', value: formatMinutes(r.cook_time_minutes) })
  const total = recipeTotalMinutes(r)
  const totalStated = r.total_time_minutes != null || (known(r.prep_time_minutes) && known(r.cook_time_minutes))
  if (known(total) && totalStated) stats.push({ label: 'Łącznie', value: formatMinutes(total) })
  return stats
}

/**
 * The two lines under a list card's title (E01-S22). Search and profile (C2, 7):
 * "Kategoria · czas" and the source. Inside a category (6) the category is the
 * page itself: "czas · źródło" and the recipe's tags ("kruche · maślane").
 * An unknown time is left out; an empty line is dropped.
 */
export function listCardLines(r: {
  category: string
  minutes: number | null
  source: string
  tagLabels?: readonly string[]
  inCategory?: boolean
}): string[] {
  const time = r.minutes != null && r.minutes > 0 ? formatMinutes(r.minutes) : null
  const lines = r.inCategory
    ? [[time, r.source].filter(Boolean).join(' · '), (r.tagLabels ?? []).join(' · ')]
    : [[categoryLabel(r.category), time].filter(Boolean).join(' · '), r.source]
  return lines.filter(Boolean)
}
