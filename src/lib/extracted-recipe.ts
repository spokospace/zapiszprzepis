// Shape guards for the LLM's recipe JSON (#381). JSON mode guarantees valid JSON,
// not the fields the prompt asked for: a nameless ingredient crashes the dedup
// (`ingredientNames` trims `name`), and a time like "15-20" or 37.5 fails the
// int insert. Both used to throw the whole, already paid, extraction away.

export interface ExtractedIngredient {
  name: string
  amount: string
  unit: string
  section: string
}

const MAX_MINUTES = 10_000

/** A string field as text: numbers become their digits ("200"), anything else an empty string. */
function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/**
 * The ingredients the recipe can be saved with: objects with a non-empty string
 * `name`, with `amount` / `unit` / `section` as strings. Anything else is dropped,
 * so a list with no usable entry comes back empty and the usability gate rejects
 * the recipe with its own reason.
 */
export function toIngredients(value: unknown): ExtractedIngredient[] {
  if (!Array.isArray(value)) return []
  const ingredients: ExtractedIngredient[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
    const raw = item as Record<string, unknown>
    if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue
    ingredients.push({ name: raw.name, amount: toText(raw.amount), unit: toText(raw.unit), section: toText(raw.section) })
  }
  return ingredients
}

/** A time the int column accepts, or null: a whole number of minutes 0–10000, given as a number or a bare numeric string. */
export function toMinutes(value: unknown): number | null {
  const n = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_MINUTES ? n : null
}
