// Ingredient shape + pure parse/group helpers for the recipe detail view.
//
// The `recipes.ingredients` column is jsonb (typed `Json`), populated by the
// extraction LLM as `[{name, amount?, unit?, section?}]`. There is no schema
// validation upstream, so the shape can drift (a bare string, a missing field,
// a non-array). These helpers are the single tolerant boundary that turns
// whatever is stored into something the view can render without crashing.

import { deriveVolumeMeasure } from './volume-measure'

export type Ingredient = {
  name?: string
  amount?: string
  unit?: string
  /** Optional household/approximate measure from the source (e.g. "ok. 1,5 szklanki",
   *  "3/4 kostki"), kept alongside the precise metric `amount`/`unit` (#505). */
  alt?: string
  section?: string
}

/**
 * Coerce a stored jsonb value into an Ingredient[]. Tolerant by design — never
 * throws (the detail page is an RSC; an exception here is a full page crash).
 * Array → as-is; JSON-array string → parsed; anything else (non-JSON string,
 * null, object, number) → []. Element-level drift (missing name, etc.) is left
 * intact for the render to handle.
 */
export function parseIngredients(raw: unknown): Ingredient[] {
  if (Array.isArray(raw)) return raw as Ingredient[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as Ingredient[]) : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * One ingredient on a single line — amount, unit and name joined in that order,
 * empty parts dropped: `{amount:'2', unit:'szklanki', name:'mąki'}` → "2 szklanki
 * mąki". Shared by the Markdown rendering and the JSON-LD `recipeIngredient`.
 *
 * `opts.alt` appends the household measure in parentheses ("… (ok. 1,5 szklanki)")
 * when there is one — the Markdown export opts in for parity with the page; the
 * JSON-LD `recipeIngredient` leaves it off so the quantity stays clean for search
 * engines (#505).
 */
export function ingredientLine(ing: Ingredient, opts?: { alt?: boolean }): string {
  const line = [ing.amount, ing.unit, ing.name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  const measure = opts?.alt ? householdMeasure(ing) : null
  return line && measure ? `${line} (${measure})` : line
}

/**
 * The household measure to show beside an ingredient's metric amount: the
 * source-stated one (`alt`) when present, otherwise one derived from a volume
 * amount via fixed ratios (`deriveVolumeMeasure`). Null when neither applies —
 * in particular, a weight amount is never turned into szklanki (density varies
 * per ingredient; see `volume-measure.ts`). The source measure always wins (#505).
 */
export function householdMeasure(ing: Ingredient): string | null {
  const stated = ing.alt?.trim()
  if (stated) return stated
  return deriveVolumeMeasure(ing.amount, ing.unit)
}

/**
 * Group ingredients by their optional `section`, preserving source order.
 * Ingredients with no section collapse into one unlabeled (`''`) group.
 *
 * NOTE (pinned limitation): grouping is contiguous run-length on `section`, so
 * interleaved sections (A, B, A) produce TWO separate "A" groups. This mirrors
 * the prior inline behavior and relies on the LLM keeping same-section
 * ingredients adjacent. Merging non-contiguous sections is a deliberate future
 * change, not done here.
 */
export function groupBySection(
  ingredients: Ingredient[],
): { section: string; items: Ingredient[] }[] {
  const groups: { section: string; items: Ingredient[] }[] = []
  for (const ing of ingredients) {
    const section = (ing?.section ?? '').trim()
    const last = groups.at(-1)
    if (last && last.section === section) last.items.push(ing)
    else groups.push({ section, items: [ing] })
  }
  return groups
}
