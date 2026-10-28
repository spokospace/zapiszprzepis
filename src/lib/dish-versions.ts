// E01-S21 — render-time helpers for the "Inne przepisy na {danie}" section: the
// ingredient diff on each version card, the badges, the bar/heading wording, and
// the client/server sort. All pure, so they are unit-tested without a DB or DOM.
import { parseIngredients } from '@/lib/ingredients'
import { servingsCount } from '@/lib/servings'
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

// Case endings a stem drops, longest first (ó is already folded into o).
const ENDINGS = [
  'iego', 'iemu',
  'ami', 'ach', 'ych', 'ich', 'ymi', 'imi', 'ego', 'emu', 'owi', 'iem', 'iej',
  'om', 'ow', 'ej', 'em', 'ie', 'ia', 'iu', 'ią', 'ię',
  'a', 'e', 'ę', 'i', 'o', 'u', 'y', 'ą',
]
const SOFT_FINAL: Record<string, string> = { ś: 's', ć: 'c', ń: 'n', ź: 'z' }

/**
 * A light Polish stem, so the inflected forms of one word meet: "ogórki" /
 * "ogórek", "piersi" / "pierś", "oleju" / "olej", "mąki" / "mąka", "soli" /
 * "sól". Folds ó into o, drops one case ending (keeping 3 letters), else the
 * fleeting e (ogórek → ogórk, cukier → cukr), and hardens a final ś/ć/ń/ź to
 * meet its si/ci/ni/zi forms.
 */
function stem(word: string): string {
  let w = word.toLocaleLowerCase('pl').replace(/ó/g, 'o')
  const ending = ENDINGS.find((e) => w.endsWith(e) && w.length - e.length >= 3)
  if (ending) w = w.slice(0, -ending.length)
  else if (/..ek$/.test(w)) w = `${w.slice(0, -2)}k`
  else if (w.endsWith('ier')) w = `${w.slice(0, -3)}r`
  const last = w.at(-1) ?? ''
  return last in SOFT_FINAL ? w.slice(0, -1) + SOFT_FINAL[last] : w
}

// Units/measures (dropped: "2 szklanki mąki" keys as {mąk}, "mix sałat" as {sałat}), filler adjectives
// (state, size, temperature: "zimna woda" is still "woda") and joining words.
// Written as words; stem() maps their other forms onto the same stem. Checked
// before the 5-letter cut, so "szczypiorek" is not taken for "szczypta".
const STOPWORD_STEMS = new Set(
  [
    // units & measures
    'szklanka', 'łyżka', 'łyżeczka', 'szczypta', 'garść', 'opakowanie', 'opak', 'paczka', 'puszka', 'słoik',
    'gram', 'dekagram', 'deko', 'dag', 'kilogram', 'litr', 'mililitr', 'sztuka', 'szt', 'pół',
    'plaster', 'plastry', 'plasterek', 'ząbek', 'listek', 'liść', 'gałązka', 'kropla', 'kubek', 'miarka', 'pęczek',
    'mix', 'mieszanka',
    // filler adjectives
    'świeży', 'drobny', 'ulubiony', 'duży', 'mały', 'średni', 'dojrzały', 'młody',
    'naturalny', 'domowy', 'dowolny', 'opcjonalnie', 'ewentualnie',
    'mielony', 'posiekany', 'pokrojony', 'starty', 'roztopiony', 'miękki',
    'zimny', 'ciepły', 'letni', 'gorący', 'wrzący', 'przegotowany',
    // joining words: "szynka lub kiełbasa", "sól do smaku", "woda według potrzeby"
    'lub', 'albo', 'oraz', 'około', 'smaku', 'według', 'potrzeby',
  ].map(stem),
)

// Synonyms collapsed to one canonical stem so "jajka" / "jaja" / "jajca" match,
// the fleeting e stem() can't see ("ocet" / "octu", "koper" / "kopru"), and the
// same ingredient under two names ("filet z kurczaka" is its breast).
const SYNONYM_STEMS = new Map<string, string>(
  [
    ['jajko', 'jajo'],
    ['jajca', 'jajo'],
    ['nać', 'natka'],
    ['octu', 'ocet'],
    ['kopru', 'koper'],
    ['wrzątek', 'woda'],
    ['filet', 'pierś'],
    ['koktajlowe', 'cherry'],
  ].map(([word, canonical]) => [stem(word), stem(canonical)]),
)

// Long enough to tell "mąka" from "makaron", short enough that "marchew" meets "marchwi".
const STEM_LENGTH = 5

/** The name without its bracketed asides ("(typ 450)", "[opcjonalnie]"). */
function withoutAsides(name: string): string {
  return name.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
}

/**
 * The comparable key of an ingredient name: the stems of its words of 3+
 * letters ("ser", "sól" count) with bracketed text dropped, units and filler
 * adjectives removed, a small synonym table applied, cut to 5 letters. An
 * ingredient reduced to nothing (only filler / units / quantities) gives an
 * EMPTY set, which — by the non-empty guard in `sameIngredient` — matches
 * nothing, so it stays its own distinct ingredient.
 */
export function ingredientKey(name: string): Set<string> {
  const key = new Set<string>()
  for (const word of withoutAsides(name).match(/\p{L}{3,}/gu) ?? []) {
    const s = stem(word)
    if (STOPWORD_STEMS.has(s)) continue
    key.add((SYNONYM_STEMS.get(s) ?? s).slice(0, STEM_LENGTH))
  }
  return key
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false
  return true
}

interface KeyedName {
  /** The name as the card shows it (`shownName`). */
  shown: string
  key: Set<string>
  /** Lowercased, bracket-stripped name, for the empty-key fallback. */
  norm: string
}

/**
 * Two ingredients are "the same" when both keys are non-empty and one contains
 * the other ("mąka" ≈ "mąka pszenna", "mąka pszenna" ≠ "mąka ziemniaczana"). A
 * name of only units / filler ("2 łyżki") reduces to an empty key; for those,
 * fall back to the normalized full name so identical names still match — while
 * an empty key never matches a non-empty one (no vacuous containment).
 */
function sameIngredient(a: KeyedName, b: KeyedName): boolean {
  if (a.key.size > 0 && b.key.size > 0) return isSubset(a.key, b.key) || isSubset(b.key, a.key)
  if (a.key.size === 0 && b.key.size === 0) return a.norm === b.norm
  return false
}

/**
 * A name as it reads inside the card's ", "-joined line: no bracketed asides,
 * no commas of its own ("zielony, mrożony groszek" would read as two
 * ingredients; a "przyprawy: sól, pieprz" list keeps its label), and the first
 * letter lowercased mid-sentence ("Mleko" → "mleko", "BBQ" stays).
 */
function shownName(name: string): string {
  const shown = withoutAsides(name).split(':')[0].replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim() || name
  return /^\p{Lu}\p{Ll}/u.test(shown) ? shown.charAt(0).toLocaleLowerCase('pl') + shown.slice(1) : shown
}

function keyedNames(raw: unknown): KeyedName[] {
  return parseIngredients(raw)
    .map((i) => (typeof i?.name === 'string' ? i.name.trim() : ''))
    .filter(Boolean)
    .map((name) => ({
      shown: shownName(name),
      key: ingredientKey(name),
      norm: withoutAsides(name).toLocaleLowerCase('pl').replace(/\s+/g, ' ').trim(),
    }))
}

/**
 * The first of each ingredient: a recipe repeats one across its sections
 * ("woda" for the dough and the syrup), which must not list it twice.
 */
function distinct(names: KeyedName[]): KeyedName[] {
  const kept: KeyedName[] = []
  for (const n of names) if (!kept.some((k) => k.shown === n.shown || sameIngredient(k, n))) kept.push(n)
  return kept
}

/**
 * What the version has that the current recipe does not (`plus`), and what the
 * current recipe has that the version does not (`minus`) — each at most `max`
 * distinct names, in source order. Sections are flattened and malformed jsonb
 * yields [].
 */
export function ingredientDiff(
  currentRaw: unknown,
  otherRaw: unknown,
  max = 4,
): { plus: string[]; minus: string[] } {
  const current = keyedNames(currentRaw)
  const other = keyedNames(otherRaw)
  const plus = distinct(other.filter((o) => !current.some((c) => sameIngredient(c, o))))
  const minus = distinct(current.filter((c) => !other.some((o) => sameIngredient(c, o))))
  return { plus: plus.slice(0, max).map((n) => n.shown), minus: minus.slice(0, max).map((n) => n.shown) }
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
    servings = servingsCount(other.servings)
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
// (The shortcut box's wording lives with it, in dish-versions-bar.tsx.)

/**
 * The genitive of common dish names, for "Inne wersje pączków". The data carries only the
 * nominative (`dish`) and the accusative, and Polish genitives are not derivable from
 * them, so this is a curated map; a dish missing here gets the case-free heading. A
 * `dish_genitive` column would replace it but needs a migration and a backfill.
 */
const DISH_GENITIVE: Readonly<Record<string, string>> = {
  pączki: 'pączków',
  pierogi: 'pierogów',
  naleśniki: 'naleśników',
  placki: 'placków',
  'placki ziemniaczane': 'placków ziemniaczanych',
  racuchy: 'racuchów',
  faworki: 'faworków',
  kopytka: 'kopytek',
  gołąbki: 'gołąbków',
  kotlety: 'kotletów',
  'kotlety mielone': 'kotletów mielonych',
  krokiety: 'krokietów',
  muffinki: 'muffinek',
  babeczki: 'babeczek',
  bułeczki: 'bułeczek',
  drożdżówki: 'drożdżówek',
  ciasteczka: 'ciasteczek',
  szarlotka: 'szarlotki',
  sernik: 'sernika',
  makowiec: 'makowca',
  babka: 'babki',
  brownie: 'brownie',
  tiramisu: 'tiramisu',
  lasagne: 'lasagne',
  pizza: 'pizzy',
  chleb: 'chleba',
  bigos: 'bigosu',
  rosół: 'rosołu',
  barszcz: 'barszczu',
  'zupa pomidorowa': 'zupy pomidorowej',
  'zupa ogórkowa': 'zupy ogórkowej',
  'sałatka jarzynowa': 'sałatki jarzynowej',
}

/** The genitive of a dish ("pączki" → "pączków"), or null when it is not in the map. */
export function dishGenitive(dish: string | null | undefined): string | null {
  const key = dish?.trim().toLocaleLowerCase('pl')
  return key ? (DISH_GENITIVE[key] ?? null) : null
}

/** Heading (handoff 16): "Inne wersje {dania w dopełniaczu} (N)", else "Inne wersje tego dania (N)". */
export function versionsHeading(n: number, dish: string | null | undefined): string {
  const genitive = dishGenitive(dish)
  return genitive ? `Inne wersje ${genitive} (${n})` : `Inne wersje tego dania (${n})`
}

// --- "Podobne" exclusion ---------------------------------------------------

// Letters, spaces and hyphens only (the same shape normalizeDish enforces).
// Re-checked here so the embedded value is safe even if a backfill or a
// service-role write stored a dish the laxer DB CHECK would have let through
// (the DB constraint only bars uppercase and bounds the length).
const SAFE_DISH = /^\p{L}[\p{L} -]*\p{L}$/u

/**
 * The PostgREST `or()` filter that drops this dish's other recipes from
 * "Podobne" while keeping null-dish rows — a plain `neq` would drop those too,
 * since `null <> x` is not true in SQL. Null when there is no dish, or a dish
 * outside the safe charset (then "Podobne" simply keeps today's behaviour).
 */
export function dishExclusionFilter(dish: string | null | undefined): string | null {
  return dish && SAFE_DISH.test(dish) ? `dish.is.null,dish.neq."${dish}"` : null
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
