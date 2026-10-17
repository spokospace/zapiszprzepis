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
import { parseIngredients } from '@/lib/ingredients'
import { postChatJson, type LabelRecipeDeps } from '@/lib/recipe-labeling'

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

// --- LLM calls (gpt-4.1, via the shared postChatJson). Never throw: a dish is a
//     nicety, never a reason to lose a recipe (same contract as labelRecipe). ---

export const DISH_PROMPT = `You classify a saved Polish recipe into a DISH grouping key and its accusative. Return ONLY JSON: {"dish": string|null, "dishAccusative": string|null, "confidence": "high"|"low"}.
- "dish": the normalized Polish name a home cook types to find ANY recipe for this thing — lowercase, nominative, 1–5 words ("sernik", "sernik na zimno", "zupa ziemniaczana", "pierogi").
- Separately NAMED preparations are separate dishes, not versions: "sernik na zimno" and "sernik gotowany" are their own dishes, NOT "sernik".
- Flavours, fillings, add-ins, toppings, origin or style ("nowojorski", "baskijski", "babci"), diet ("bez glutenu"), size ("mini") and praise ("najlepszy") are VERSION traits — they go in variant_note, NEVER in dish.
- A qualifier stays in dish only when it names a separately-named dish a cook would not swap for the plain one.
- Bare class words name their kind: "zupa ziemniaczana", "ciasteczka owsiane" — never a bare "zupa" / "ciasto" / "sałatka" / "deser" / "danie".
- A salad or surówka named only by its ingredients, with no established name, → dish null.
- When the dish is unclear or not a single recognisable dish → dish null, confidence "low".
- "dishAccusative": the SAME dish in the Polish accusative, for "Inne przepisy na {acc}" ("szarlotka"→"szarlotkę", "zupa ziemniaczana"→"zupę ziemniaczaną"). Same number of words as dish. For a plural-only or masculine-inanimate dish it equals the nominative ("pierogi"→"pierogi"). null if unsure.
- "confidence": "high" only when you are sure of the dish; otherwise "low" (stored as null).
Examples:
  "Sernik" → "sernik"
  "Sernik nowojorski" → "sernik" (style is a version)
  "Sernik na zimno" → "sernik na zimno" (no oven, set with gelatine: a separate dish)
  "Sernik gotowany" → "sernik gotowany" (cooked filling, own name)
  "Pierogi ruskie" → "pierogi" (the filling is a version)
  "Ciasto z owocami" → null (no single recognisable dish)
Reuse an EXISTING dish name below verbatim when it fits, instead of coining a near-synonym.`

export const VARIANT_NOTE_PROMPT = `You write a short Polish VARIANT NOTE for one recipe: what sets it apart from the other recipes for the same dish. Return ONLY JSON: {"variantNote": string|null}.
- 2–6 Polish words, a capital first letter, no full stop.
- Say what makes THIS version different (its base or dough, a key ingredient, a technique, a diet), using ONLY its own ingredients and steps. Never invent anything.
- It MUST differ from every sibling note listed. With no siblings, compare against the typical recipe for the dish.
- Do not repeat the dish name.
- If you cannot tell, return null.`

/** The dish's ingredient names only (no amounts), tolerant of malformed jsonb. */
function ingredientNames(ingredients: unknown): string[] {
  return parseIngredients(ingredients)
    .map((i) => i.name?.trim())
    .filter((n): n is string => Boolean(n))
}

export interface ClassifyDishInput {
  title: string
  category: string
  ingredients: unknown
  steps: unknown
}

export interface DishClassification {
  dish: string | null
  dishAccusative: string | null
  /** True when the call SUCCEEDED (even if dish is null); false only on HTTP / timeout / JSON error. */
  classified: boolean
}

/**
 * The dish and its accusative for a recipe, reusing the existing dish vocabulary
 * so the model snaps to a name already in use. `classified` is true whenever the
 * call completed — a successful "no single dish" (null) still counts, so the
 * gap-fill never re-runs it. Any HTTP / timeout / JSON error returns nulls with
 * `classified: false`, logged, never thrown.
 */
export async function classifyDish(
  recipe: ClassifyDishInput,
  vocabulary: DishVocabularyEntry[],
  deps: LabelRecipeDeps,
): Promise<DishClassification> {
  try {
    const names = dishVocabularyFor(recipe.title, vocabulary)
    const out = await postChatJson(
      [
        {
          role: 'system',
          content: `${DISH_PROMPT}\n\nEXISTING dish names:\n${names.length ? names.map((v) => `- ${v.dish}`).join('\n') : '(none)'}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: recipe.title,
            category: recipe.category,
            ingredients: ingredientNames(recipe.ingredients),
            steps: recipe.steps,
          }).slice(0, 12_000),
        },
      ],
      0,
      deps,
    )
    const dish = normalizeDish(out, vocabulary.map((v) => v.dish))
    return { dish, dishAccusative: resolveDishAccusative(out, dish), classified: true }
  } catch (error) {
    console.warn('[classify-dish] classification failed:', error)
    return { dish: null, dishAccusative: null, classified: false }
  }
}

export interface VariantNoteTarget {
  dish: string
  title: string
  ingredients: unknown
  steps: unknown
}

export interface VariantNoteSibling {
  title: string
  ingredients: unknown
  variant_note: string | null
}

/**
 * The variant note for a newly classified recipe, told to differ from its (up
 * to 12) siblings' notes. Siblings' notes are never rewritten, so existing cards
 * stay stable. Returns null when the model gives nothing usable or on any error
 * (logged, never thrown).
 */
export async function writeVariantNote(
  target: VariantNoteTarget,
  siblings: VariantNoteSibling[],
  deps: LabelRecipeDeps,
): Promise<string | null> {
  const notes = siblings.map((s) => s.variant_note).filter((n): n is string => Boolean(n))
  try {
    const out = await postChatJson(
      [
        { role: 'system', content: VARIANT_NOTE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            dish: target.dish,
            recipe: { title: target.title, ingredients: ingredientNames(target.ingredients), steps: target.steps },
            siblings: siblings.slice(0, 12).map((s) => ({
              title: s.title,
              ingredients: ingredientNames(s.ingredients),
              variantNote: s.variant_note,
            })),
          }).slice(0, 12_000),
        },
      ],
      0,
      deps,
    )
    return resolveVariantNote((out as { variantNote?: unknown })?.variantNote, target.dish, notes)
  } catch (error) {
    console.warn('[variant-note] generation failed:', error)
    return null
  }
}
