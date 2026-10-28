// Shape guards for the LLM's recipe JSON (#381). JSON mode guarantees valid JSON,
// not the fields the prompt asked for: a nameless ingredient crashes the dedup
// (`ingredientNames` trims `name`), and a time like "15-20" or 37.5 fails the
// int insert. Both used to throw the whole, already paid, extraction away.

import { containerMeasure } from './container-measure'
import { householdAlt } from './household-alt'
import { metricIngredient, metricUnits } from './us-units'

export interface ExtractedIngredient {
  name: string
  amount: string
  unit: string
  /** Household/approximate measure from the source (e.g. "3/4 kostki"), "" when none (#505). */
  alt: string
  section: string
}

const MAX_MINUTES = 10_000

/** A string field as text: numbers become their digits ("200"), anything else an empty string. */
function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

// A Polish household unit: what `alt` is for ("3/4 kostki", "półtorej szklanki",
// "płaska łyżka", "garść", "1 tabliczka"). Matched loosely, so a Polish source's
// measure is never mistaken for a note, however it is worded.
const HOUSEHOLD_UNIT =
  /szklan|łyż|kost|garś|garst|plast|szczypt|opakowa|puszk|puszek|ząb|pęcz|sztuk|kromk|kawał|kropl|odrobin|filiżan|kub|słoik|słoicz|torebk|paczk|list|liść|gałąz|łodyg|główk|tabliczk|lask|kieliszk|gałk|bryłk|płat|porcj|saszet/i
// How full the stated spoon is ("płaska" beside 1 łyżeczka): part of the measure.
const SPOON_FILL = /^(płask|czubat|kopiat|kopiast|pełn|niepełn)\p{L}*$/iu
// ...except as a cut: "pokrojone w kostkę", "w plasterkach", "na kawałki" is a
// note. (`\b` is ASCII-only, so no `\b` next to ł/ó.)
const CUT = /(^|\s)(w|na)\s+(kost|plast|kawał|pask|krąż|słupk|ćwiart)/i
// A US weight or measure the model copied instead of a Polish one (#524): the
// metric value is already in amount/unit, so it adds nothing a Polish cook uses.
const FOREIGN_MEASURE =
  /\b(funt|funta|funty|funtów|uncj\w*|lbs?|oz|ounces?|pounds?|cups?|tbsp|tsp|tablespoons?|teaspoons?|sticks?|pinch|dash|splash|handful)\b/i

/**
 * `alt` carries a household measure only (#505). The model also parks pounds and
 * ounces there, and preparation notes ("pokrojone", "finely grated"), which the
 * prompt says belong in the name (#524). A Polish measure stays, even beside a
 * foreign one ("1 łyżka (ok. 1 oz)"); a foreign measure alone is dropped when the
 * metric amount is there; a note moves into the name; a bare number stays.
 */
function settleAlt(name: string, amount: string, unit: string, alt: string): { name: string; alt: string } {
  const measure = alt.trim()
  if (!measure || !/\p{L}/u.test(measure)) return { name, alt: measure }
  const lower = measure.toLowerCase()
  // The amount itself again ("1 garść" beside 1 garść): nothing to add.
  if (lower === `${amount} ${unit}`.trim().toLowerCase()) return { name, alt: '' }
  if (HOUSEHOLD_UNIT.test(measure) && !CUT.test(measure)) return { name, alt: measure }
  if (SPOON_FILL.test(measure)) return { name, alt: measure }
  if (FOREIGN_MEASURE.test(measure)) return { name, alt: amount.trim() ? '' : measure }
  const note = name.toLowerCase().includes(lower) ? name : `${name.trimEnd()} ${measure}`
  return { name: note, alt: '' }
}

/**
 * The ingredients the recipe can be saved with: objects with a non-empty string
 * `name`, with `amount` / `unit` / `alt` / `section` as strings. Anything else is dropped,
 * so a list with no usable entry comes back empty and the usability gate rejects
 * the recipe with its own reason. `alt` is settled by `settleAlt`.
 */
export function toIngredients(value: unknown): ExtractedIngredient[] {
  if (!Array.isArray(value)) return []
  const ingredients: ExtractedIngredient[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
    const raw = item as Record<string, unknown>
    if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue
    // A packaged US ingredient is totalled from its source line, any other US
    // unit written metric — before settleAlt, which compares `alt` with the measure as saved.
    const source = toText(raw.source)
    const packaged = containerMeasure(source)
    const metric = packaged
      ? { name: metricUnits(raw.name), amount: packaged.amount, unit: packaged.unit }
      : metricIngredient({ name: raw.name, amount: toText(raw.amount), unit: toText(raw.unit) })
    // The measure the source line states beats the model's `alt`: exact, and
    // there even when the model left `alt` empty.
    const stated = packaged?.alt || householdAlt(source) || toText(raw.alt)
    const { name, alt } = settleAlt(metric.name, metric.amount, metric.unit, stated)
    ingredients.push({ name, amount: metric.amount, unit: metric.unit, alt, section: toText(raw.section) })
  }
  return ingredients
}

/** A time the int column accepts, or null: a whole number of minutes 0–10000, given as a number or a bare numeric string. */
export function toMinutes(value: unknown): number | null {
  const n = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_MINUTES ? n : null
}
