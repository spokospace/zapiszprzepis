// E01-S21 — render-time helpers for the "Inne przepisy na {danie}" section: the
// ingredient diff on each version card, the badges, the bar/heading wording, and
// the client/server sort. All pure, so they are unit-tested without a DB or DOM.
import { stems } from '@/lib/recipe-tags'
import { parseIngredients } from '@/lib/ingredients'
import { polishPlural } from '@/lib/recipe-meta'
import { formatMinutes } from '@/lib/format-minutes'
import type { RecipeSource } from '@/lib/recipe-source'

/** One row of the `dish_versions` RPC. */
export interface DishVersionRow {
  id: number
  slug: string
  title: string
  image_url: string | null
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  variant_note: string | null
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  times_estimated: boolean
  ingredients: unknown
  created_at: string
  favorites_count: number
  total_count: number
}

// --- Ingredient diff -------------------------------------------------------

// Units/measures (dropped: "2 szklanki mąki" keys as {mąka}) and filler
// adjectives, as the 5-letter stems stems() produces — enumerated across the
// common Polish case endings, since a short word declines inside the 5 chars.
const STOPWORD_STEMS = new Set<string>([
  // units & measures
  'szkla', // szklanka/i/ę/ek
  'łyżka', 'łyżki', 'łyżkę', 'łyżek', 'łyżką', 'łyżce',
  'łyżec', // łyżeczka/i
  'szczy', // szczypta
  'garść', 'garśc',
  'opako', 'puszk', 'słoik',
  'gram', 'gramó', 'gramy', 'grama',
  'dekag', 'deka', 'deko',
  'litr', 'litra', 'litró',
  'sztuk', 'sztuc',
  'plast', 'ząbek', 'ząbka', 'ząbki',
  'liste', 'listk', 'gałąz', 'kropl', 'kubek', 'kubka', 'miark', 'miare',
  // filler adjectives
  'śwież', 'drobn', 'ulubi',
  'duży', 'duże', 'dużą', 'dużej',
  'mały', 'małe', 'małą', 'małej',
  'średn', 'dojrz', 'młody', 'młode', 'młodą',
  'natur', 'domow', 'dowol', 'opcjo', 'ewent',
])

// Synonyms collapsed to one canonical stem so "jajka" / "jaja" / "jajek" match.
const SYNONYM_STEMS = new Map<string, string>([
  ['jajko', 'jaj'],
  ['jajka', 'jaj'],
  ['jajek', 'jaj'],
  ['jajca', 'jaj'],
  ['jaja', 'jaj'],
])

/**
 * The comparable key of an ingredient name: its 5-letter stems with bracketed
 * text dropped, units and filler adjectives removed, and a small synonym table
 * applied. An ingredient reduced to nothing (only filler / units / quantities)
 * gives an EMPTY set, which — by the non-empty guard in `keysMatch` — matches
 * nothing, so it stays its own distinct ingredient.
 */
export function ingredientKey(name: string): Set<string> {
  const cleaned = name
    .toLocaleLowerCase('pl')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
  const key = new Set<string>()
  for (const stem of stems(cleaned)) {
    if (STOPWORD_STEMS.has(stem)) continue
    key.add(SYNONYM_STEMS.get(stem) ?? stem)
  }
  return key
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false
  return true
}

/** Two ingredients are "the same" when both keys are non-empty and one contains
 *  the other ("mąka" ≈ "mąka pszenna", "mąka pszenna" ≠ "mąka ziemniaczana"). */
function keysMatch(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  return isSubset(a, b) || isSubset(b, a)
}

function keyedNames(raw: unknown): { name: string; key: Set<string> }[] {
  return parseIngredients(raw)
    .map((i) => i.name?.trim())
    .filter((n): n is string => Boolean(n))
    .map((name) => ({ name, key: ingredientKey(name) }))
}

/**
 * What the version has that the current recipe does not (`plus`), and what the
 * current recipe has that the version does not (`minus`) — each at most `max`
 * names, in source order. Sections are flattened and malformed jsonb yields [].
 */
export function ingredientDiff(
  currentRaw: unknown,
  otherRaw: unknown,
  max = 4,
): { plus: string[]; minus: string[] } {
  const current = keyedNames(currentRaw)
  const other = keyedNames(otherRaw)
  const plus = other.filter((o) => !current.some((c) => keysMatch(c.key, o.key))).map((o) => o.name)
  const minus = current.filter((c) => !other.some((o) => keysMatch(c.key, o.key))).map((c) => c.name)
  return { plus: plus.slice(0, max), minus: minus.slice(0, max) }
}

// --- Badges ----------------------------------------------------------------

interface BadgeTimes {
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  times_estimated: boolean
}

/** Total time: the stated total, else prep + cook when both are known, else null. */
function totalTime(r: Pick<BadgeTimes, 'prep_time_minutes' | 'cook_time_minutes' | 'total_time_minutes'>): number | null {
  if (r.total_time_minutes != null) return r.total_time_minutes
  if (r.prep_time_minutes != null && r.cook_time_minutes != null) return r.prep_time_minutes + r.cook_time_minutes
  return null
}

const TIME_DELTA_THRESHOLD = 10

/**
 * The two card badges comparing a version with the current recipe: servings
 * ("8 porcji (o 4 mniej)") and time ("1 godz 30 min (krócej)"). A badge is null
 * when the version lacks that value; the "(o N mniej/więcej)" / "(krócej)/(dłużej)"
 * comparison is dropped when the current recipe lacks it or the gap is small.
 */
export function versionBadges(current: BadgeTimes, other: BadgeTimes): { servings: string | null; time: string | null } {
  let servings: string | null = null
  if (other.servings != null) {
    servings = `${other.servings} ${polishPlural(other.servings, 'porcja', 'porcje', 'porcji')}`
    if (current.servings != null) {
      const delta = other.servings - current.servings
      if (delta > 0) servings += ` (o ${delta} więcej)`
      else if (delta < 0) servings += ` (o ${-delta} mniej)`
    }
  }

  let time: string | null = null
  const otherTime = totalTime(other)
  if (otherTime != null) {
    time = `${other.times_estimated ? '≈ ' : ''}${formatMinutes(otherTime)}`
    const currentTime = totalTime(current)
    if (currentTime != null) {
      const delta = otherTime - currentTime
      if (delta <= -TIME_DELTA_THRESHOLD) time += ' (krócej)'
      else if (delta >= TIME_DELTA_THRESHOLD) time += ' (dłużej)'
    }
  }

  return { servings, time }
}

// --- Wording ---------------------------------------------------------------

/** Bar: "Mamy jeszcze N inne przepisy na {acc}" (or "… na to danie" without one). */
export function versionsBarLabel(n: number, dishAccusative: string | null): string {
  const phrase = polishPlural(n, 'inny przepis', 'inne przepisy', 'innych przepisów')
  return `Mamy jeszcze ${n} ${phrase} na ${dishAccusative ?? 'to danie'}`
}

/** Heading: "Inne przepisy na {acc} (N)" (or "Inne wersje tego dania (N)"). */
export function versionsHeading(n: number, dishAccusative: string | null): string {
  return dishAccusative ? `Inne przepisy na ${dishAccusative} (${n})` : `Inne wersje tego dania (${n})`
}

// --- Sort ------------------------------------------------------------------

export type VersionsSort = 'popularne' | 'nowe' | 'szybkie'
const SORT_KEYS: readonly VersionsSort[] = ['popularne', 'nowe', 'szybkie']

/** The sort order from a `?wersje=` value; anything off-list falls back to popularne. */
export function parseVersionsSort(raw: unknown): VersionsSort {
  return typeof raw === 'string' && (SORT_KEYS as readonly string[]).includes(raw) ? (raw as VersionsSort) : 'popularne'
}

/** created_at desc, then id desc — the shared tie-break for every order. */
function byRecency(a: DishVersionRow, b: DishVersionRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
  return b.id - a.id
}

/**
 * The versions in the reader's chosen order, as a new array (never mutated):
 * popularne = favorites first, nowe = newest first, szybkie = quickest first
 * (unknown times last). Every order breaks ties by recency.
 */
export function sortVersions(rows: DishVersionRow[], order: VersionsSort): DishVersionRow[] {
  const sorted = [...rows]
  if (order === 'nowe') {
    sorted.sort(byRecency)
  } else if (order === 'szybkie') {
    sorted.sort((a, b) => {
      const ta = totalTime(a)
      const tb = totalTime(b)
      if (ta !== tb) {
        if (ta == null) return 1
        if (tb == null) return -1
        return ta - tb
      }
      return byRecency(a, b)
    })
  } else {
    sorted.sort((a, b) => (a.favorites_count !== b.favorites_count ? b.favorites_count - a.favorites_count : byRecency(a, b)))
  }
  return sorted
}
