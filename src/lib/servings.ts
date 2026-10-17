import { polishPlural } from '@/lib/recipe-meta'
import { LD_JSON_RE, ldType } from '@/lib/recipe-image-archive'

// Servings (recipes.servings, 1–99): what the source states, never an estimate.

const MIN_SERVINGS = 1
const MAX_SERVINGS = 99

/** A servings count the column accepts, or null: an integer 1–99, given as a
 *  number or a bare numeric string (the LLM returns either). */
export function toServings(value: unknown): number | null {
  const n = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_SERVINGS && n <= MAX_SERVINGS ? n : null
}

/** "na 1 porcję", "na 2 porcje", "na 5 porcji", "na 12 porcji", "na 22 porcje". */
export function servingsLabel(servings: number): string {
  return `na ${servings} ${polishPlural(servings, 'porcję', 'porcje', 'porcji')}`
}

// Words that make a yield a count of servings. Anything else ("1 tortownica 24 cm",
// "24 sztuki", "1 l") counts something other than servings and is not one.
const SERVINGS_WORDS = /porcj|os[óo]b|serv(es|ings?)|portions?|people|persons?/i

/**
 * Servings from a schema.org recipeYield: a number, a string, or an array of
 * either (WordPress recipe plugins emit ["4", "4 porcje"]). A string counts only
 * when it is a bare number or one number next to a servings word; a range
 * ("4–6 porcji") or a yield in pieces, tins or litres is no servings count.
 */
export function parseRecipeYield(value: unknown): number | null {
  for (const item of Array.isArray(value) ? value : [value]) {
    if (typeof item === 'number') {
      const n = toServings(item)
      if (n != null) return n
      continue
    }
    if (typeof item !== 'string') continue
    const text = item.trim()
    const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? []
    if (numbers.length !== 1) continue
    if (!/^\d+$/.test(text) && !SERVINGS_WORDS.test(text)) continue
    const n = toServings(numbers[0])
    if (n != null) return n
  }
  return null
}

/** Servings from the Recipe node of a page's JSON-LD, or null. */
export function jsonLdServings(html: string): number | null {
  let found: number | null = null
  const visit = (node: unknown): void => {
    if (found != null) return
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    if (ldType(record).split(' ').includes('recipe') && record.recipeYield != null) {
      found = parseRecipeYield(record.recipeYield)
      if (found != null) return
    }
    for (const value of Object.values(record)) if (value && typeof value === 'object') visit(value)
  }
  for (const [, body] of html.matchAll(LD_JSON_RE)) {
    try {
      visit(JSON.parse(body.trim()))
    } catch {
      // A malformed block just contributes nothing.
    }
    if (found != null) break
  }
  return found
}
