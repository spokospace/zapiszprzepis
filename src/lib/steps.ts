// Pure parse helper for the `recipes.steps` jsonb column on the detail view.
//
// The column is written by the extraction LLM, the gap-fill / refresh paths and
// maintenance scripts, with no schema validation, so the stored value can be a
// non-array (object, number, malformed string) or an array holding non-strings.
// Like parseIngredients, this is the tolerant boundary between whatever is
// stored and what the RSC renders.

/**
 * Coerce a stored jsonb value into a list of step strings. Never throws (the
 * detail page is an RSC; an exception there is a full page crash). Array →
 * its non-empty string entries, trimmed; JSON-array string → parsed, then the
 * same; anything else → []. Non-string entries are dropped, because rendering
 * an object as a React child throws.
 */
export function parseSteps(raw: unknown): string[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return value.filter(isStepText).map((step) => step.trim())
}

/** A step the detail page can render: a string with visible text. */
export function isStepText(step: unknown): step is string {
  return typeof step === 'string' && step.trim().length > 0
}

/**
 * Coerce the stored `recipes.step_images` (text[]) into a list index-aligned with
 * `steps`: element i is step i's archived image URL, or '' when that step has none.
 * Positions are preserved (never filtered) so steps[i] and stepImages[i] stay in
 * sync. Non-strings and non-http values become ''. Never throws (RSC boundary).
 */
export function parseStepImages(raw: unknown): string[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return value.map((img) => (typeof img === 'string' && /^https?:\/\//.test(img.trim()) ? img.trim() : ''))
}
