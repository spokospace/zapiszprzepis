// Ingredient shape + pure parse/group helpers for the recipe detail view.
//
// The `recipes.ingredients` column is jsonb (typed `Json`), populated by the
// extraction LLM as `[{name, amount?, unit?, section?}]`. There is no schema
// validation upstream, so the shape can drift (a bare string, a missing field,
// a non-array). These helpers are the single tolerant boundary that turns
// whatever is stored into something the view can render without crashing.

export type Ingredient = {
  name?: string
  amount?: string
  unit?: string
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
