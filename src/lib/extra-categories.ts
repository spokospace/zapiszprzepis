import { MAX_EXTRA_CATEGORIES } from '@/lib/category-membership'
import { postChatJson, type LabelRecipeDeps } from '@/lib/recipe-labeling'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@/lib/recipe-categories'

/**
 * LLM-assigned extra categories (issue #689, slice 2). A recipe keeps its primary
 * category; the model may name up to MAX_EXTRA_CATEGORIES more lists the dish also
 * belongs in. Over-assignment is the risk (a dish in every list is no list at all),
 * so there are three layers: a prompt that makes "none" the default, `toExtraCategories`
 * (closed list, never the primary, never "inne", deduped, capped), and the database
 * CHECK behind it.
 */

/** The rule text shared by the extraction prompt and the backfill classifier. */
export const EXTRA_CATEGORIES_RULE = `Extra categories ("extra_categories"): a list of 0–${MAX_EXTRA_CATEGORIES} MORE categories (never the main one, never "inne") the dish ALSO belongs in. Almost every dish needs none: return [] unless the dish is clearly and typically found in both lists, and when in any doubt return []. The ONLY two overlaps allowed: finger food that is also breakfast food (sandwiches, toasts, baked sandwiches, stuffed eggs, a snack board built around breakfast items, tortilla wraps) is "przekaski" + "sniadania"; a salad served as finger food (in shells, tartlets, on skewers or crackers) is "przekaski" + "salatki" (drinks, juices, syrups and infusions get no extra). Everything else is []: sweet categories ("ciasta", "desery", "ciasteczka") are NEVER extras of each other or of a savoury list (a tort is not a dessert, tiramisu is not a cake, pancakes are not snacks); a main dish, soup, bread or preserve gets no extra only because it could also be served at another meal.`

/**
 * The extras the model returned, made safe: only known category values or labels,
 * never the primary, never "inne", no repeats, at most MAX_EXTRA_CATEGORIES. Anything
 * unreadable is `[]`. Unlike the primary (`toRecipeCategory`), an unknown value is
 * dropped, not turned into "inne": an extra is optional.
 */
export function toExtraCategories(raw: unknown, primary: string): RecipeCategory[] {
  if (!Array.isArray(raw)) return []
  const out: RecipeCategory[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const folded = fold(item)
    const match = RECIPE_CATEGORIES.find((c) => c.value === folded || fold(c.label) === folded)
    if (!match || match.value === 'inne' || match.value === primary || out.includes(match.value)) continue
    out.push(match.value)
    if (out.length === MAX_EXTRA_CATEGORIES) break
  }
  return out
}

function fold(text: string): string {
  return text.trim().toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export interface ExtraCategoryInput {
  title: string
  category: string
  ingredients: unknown
  steps: unknown
}

const CLASSIFIER_PROMPT = `You assign EXTRA category lists to a saved Polish recipe whose main category is already decided and must not change.
Categories: ${RECIPE_CATEGORIES.map((c) => `${c.value} (${c.label})`).join(', ')}.
Return ONLY JSON: {"extra_categories": [...]} using category values from the list.
${EXTRA_CATEGORIES_RULE}`

/**
 * Asks the labelling model for the extras of a stored recipe (the backfill). Throws on
 * a failed call so a script can retry or skip; an unreadable answer is `[]`.
 */
export async function classifyExtraCategories(recipe: ExtraCategoryInput, deps: LabelRecipeDeps): Promise<RecipeCategory[]> {
  const out = (await postChatJson(
    [
      { role: 'system', content: CLASSIFIER_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          title: recipe.title,
          category: recipe.category,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }).slice(0, 8_000),
      },
    ],
    0,
    deps,
  )) as { extra_categories?: unknown } | null
  return toExtraCategories(out?.extra_categories, recipe.category)
}

/**
 * A small review sample for the precision check: up to `size` rows spread round-robin
 * over the primary categories (the largest lists first), oldest ids first within one,
 * so every list is looked at and the sample is the same on every run.
 */
export function pickPrecisionSample<T extends { id: number; category: string }>(rows: readonly T[], size: number): T[] {
  const groups = new Map<string, T[]>()
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const list = groups.get(row.category)
    if (list) list.push(row)
    else groups.set(row.category, [row])
  }
  const queues = [...groups.values()].sort((a, b) => b.length - a.length)
  const sample: T[] = []
  for (let i = 0; sample.length < size && queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      if (i < q.length && sample.length < size) sample.push(q[i])
    }
  }
  return sample
}
