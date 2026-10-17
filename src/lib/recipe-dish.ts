// E01-S21 — the dish grouping key and the variant note. A recipe's `dish`
// ("sernik", "zupa ziemniaczana") groups it with the site's other recipes for
// the same thing; `variant_note` ("Na kruchym cieście, bez drożdży") says what
// sets this version apart. Both are set by a small LLM pass beside labelRecipe
// (see classifyDish / writeVariantNote, added alongside these pure helpers).
//
// These validators run on every value before it is stored — from the runtime
// LLM and from the #298 backfill alike — so the two paths cannot drift. The LLM
// side lives in the same file but never runs in a test of these helpers.
import { stems } from '@/lib/recipe-tags'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

/** One row of `dish_vocabulary()`: a distinct dish, a representative accusative, its recipe count. */
export interface DishVocabularyEntry {
  dish: string
  dishAccusative: string | null
  recipes: number
}

/** The LLM's dish classification, before validation. */
export interface DishClassificationRaw {
  dish?: unknown
  dishAccusative?: unknown
  confidence?: unknown
}

// Bare class words and category labels never group as a dish: "ciasto" alone
// would collect 86 unrelated recipes. The handoff's list plus every category
// label, stored and compared in their diacritic-folded form so a diacritic-less
// spelling ("salatka", "napoj") is blocked too.
const DISH_BLOCKLIST: ReadonlySet<string> = new Set(
  [
    'ciasto', 'ciasta', 'ciasteczka', 'zupa', 'sałatka', 'surówka', 'deser', 'danie',
    'obiad', 'przekąska', 'napój', 'syrop', 'pieczywo', 'inne',
    ...RECIPE_CATEGORIES.map((c) => c.label),
  ].map((w) => fold(w)),
)

// Diacritic-folded form ("pierogi ruskie" == "pierogi ruskie" typed without
// diacritics), for snapping a value to an existing vocabulary spelling. `ł` has
// no NFD decomposition, so it is replaced first (as in recipe-categories).
function fold(text: string): string {
  return text.toLocaleLowerCase('pl').replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Letters, spaces and hyphens, starting and ending with a letter — no digits,
// no punctuation. Also makes the value safe to quote inside a PostgREST or()
// filter (SimilarRecipes). Length and word count are checked separately.
const DISH_CHARSET = /^\p{L}[\p{L} -]*\p{L}$/u

/** NFC, trim, collapse whitespace, strip surrounding quotes and trailing punctuation, lowercase. */
function cleanDishText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'„”«»]+/, '')
    .replace(/["'„”«».,;:!]+$/, '')
    .trim()
    .toLocaleLowerCase('pl')
}

/**
 * The stored `dish`, or null when the LLM gave nothing usable. Rejects a
 * non-string or non-high-confidence answer, anything outside the charset, under
 * 3 / over 60 chars, more than 5 words, or a bare class / category word. A
 * value whose diacritic-folded form matches a vocabulary entry takes the
 * vocabulary's spelling, so "pierogi ruskie" never splits on diacritics.
 */
export function normalizeDish(raw: unknown, vocabulary: string[] = []): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { dish, confidence } = raw as DishClassificationRaw
  if (typeof dish !== 'string' || confidence !== 'high') return null
  const value = cleanDishText(dish)
  if (!DISH_CHARSET.test(value)) return null
  if (value.length < 3 || value.length > 60) return null
  if (value.split(' ').length > 5) return null
  if (DISH_BLOCKLIST.has(fold(value))) return null
  const folded = fold(value)
  return vocabulary.find((d) => fold(d) === folded) ?? value
}

/**
 * The accusative of the dish ("na szarlotkę"), or null when the LLM's value is
 * unusable. Requires a non-null `dish`, the same charset, 3–80 chars, and the
 * same number of words as `dish` (the accusative of a plural-only or
 * masculine-inanimate dish equals the nominative, which is valid).
 */
export function resolveDishAccusative(raw: unknown, dish: string | null): string | null {
  if (dish === null) return null
  if (typeof raw !== 'object' || raw === null) return null
  const { dishAccusative } = raw as DishClassificationRaw
  if (typeof dishAccusative !== 'string') return null
  const value = cleanDishText(dishAccusative)
  if (!DISH_CHARSET.test(value)) return null
  if (value.length < 3 || value.length > 80) return null
  if (value.split(' ').length !== dish.split(' ').length) return null
  return value
}

/**
 * The stored `variant_note`, or null when the LLM gave nothing usable. Strips a
 * trailing period, drops comma-parts that only repeat a `dish` word (the
 * resolveDescription technique — "Sernik na zimno" → the note never re-says
 * "sernik"), sentence-cases the first letter, requires 3–60 chars, and rejects a
 * note equal (case-insensitively) to one of the dish's existing sibling notes.
 */
export function resolveVariantNote(raw: unknown, dish: string | null, siblingNotes: string[] = []): string | null {
  const value = typeof raw === 'object' && raw !== null ? (raw as { variantNote?: unknown }).variantNote : raw
  if (typeof value !== 'string') return null
  const dishStems = new Set(dish ? stems(dish) : [])
  const text = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !stems(part).some((s) => dishStems.has(s)))
    .join(', ')
  if (text.length < 3 || text.length > 60) return null
  const note = text.charAt(0).toLocaleUpperCase('pl') + text.slice(1)
  const noteKey = note.toLocaleLowerCase('pl')
  if (siblingNotes.some((s) => s.toLocaleLowerCase('pl') === noteKey)) return null
  return note
}

/**
 * The vocabulary entries whose dish shares a word stem with the title, most
 * frequent first (the vocabulary comes ordered that way), capped at `max`. The
 * LLM is shown only these, so the prompt stays small as the catalog grows.
 */
export function dishVocabularyFor(
  title: string,
  vocabulary: DishVocabularyEntry[],
  max = 60,
): DishVocabularyEntry[] {
  const titleStems = new Set(stems(title))
  return vocabulary.filter((v) => stems(v.dish).some((s) => titleStems.has(s))).slice(0, max)
}
