// Labelling: a second, small LLM pass over an already-extracted recipe that
// sets the presentation fields — the title's casing, the distinguishing note
// and the tags. Kept apart from extraction for two reasons:
//   - the backfill script labels stored recipes with the very same call, so
//     old and new recipes follow one set of rules;
//   - tagging needs judgement gpt-4o-mini lacked (it tagged bread rolls and
//     pizza "kruche"), while extraction is fine on the cheap model. The input
//     here is one recipe plus the user's similarly titled ones, so the bigger
//     model costs next to nothing.
import { LLM_TAGS, MAX_TAGS, resolveTags, resolveDescription, stems, type RecipeTag } from '@/lib/recipe-tags'

export const LABEL_MODEL = 'gpt-4.1'

export interface LabelInput {
  title: string
  category: string
  ingredients: unknown
  steps: unknown
  prepTimeMinutes?: number | null
  cookTimeMinutes?: number | null
  totalTimeMinutes?: number | null
}

export interface RecipeLabels {
  title: string
  description: string | null
  tags: RecipeTag[]
}

export interface LabelRecipeDeps {
  fetch: typeof globalThis.fetch
  apiKey: string | undefined
}

export const LABELING_PROMPT = `You label a saved Polish recipe. Return ONLY JSON: {"title": "...", "description": "...", "tags": [...]}.
- "title": the same title in Polish sentence case — a capital letter only at the start of each sentence and in proper names ("Bardzo Kruche Ciastka" → "Bardzo kruche ciastka", "Sernik Po Wiedeńsku" → "Sernik po wiedeńsku"; keep "Boże Narodzenie", "Pani Walewska", "Tiramisu", and a capital after "!", "?" or "."). Change only letter case — never add, drop or reword anything.
- "description": 2–5 words in Polish, lowercase, naming what sets THIS recipe apart from other recipes with a similar title — a key ingredient or technique taken from ITS ingredients and steps (e.g. "na ugotowanych żółtkach", "bez jajek", "z masłem orzechowym"). Never invent an ingredient that is not in the recipe. Never repeat or rephrase words already in the title. If the user already has recipes with a similar title (listed at the end), pick a feature that differs from their notes.
- "tags": 0–${MAX_TAGS - 1} values. Go through the list below and pick EVERY tag whose meaning the recipe clearly meets, judged from its ingredients and steps; pick none that it doesn't. Use [] when nothing fits. Allowed values (value: meaning):
${LLM_TAGS.map((t) => `  ${t.value}: ${t.hint}`).join('\n')}`

/** The user's recipes whose title shares a word with this one: the only ones
 *  the note has to be told apart from. Keeps the prompt small however many
 *  recipes the user has. */
export function similarRecipes<T extends { title: string }>(title: string, recipes: T[]): T[] {
  const titleStems = new Set(stems(title))
  return recipes.filter((r) => stems(r.title).some((s) => titleStems.has(s)))
}

/** The user's recipes as prompt lines, so a new note can differ from theirs. */
export function formatExistingRecipes(recipes: { title: string; description: string | null }[]): string {
  if (recipes.length === 0) return '(none)'
  return recipes.map((r) => `- ${r.title}${r.description ? ` — ${r.description}` : ''}`).join('\n')
}

/** The LLM's title, but only when it differs from the original by letter case
 *  alone: labelling may fix "Bardzo Kruche Ciastka", never reword a title. */
export function resolveTitle(raw: unknown, original: string): string {
  if (typeof raw !== 'string') return original
  const title = raw.trim()
  return title.toLocaleLowerCase('pl') === original.trim().toLocaleLowerCase('pl') ? title : original
}

/**
 * Title casing, note and tags for a recipe. Never throws: when the LLM call
 * fails, the recipe keeps its title, gets no note and only the tags its title
 * and times imply — labels are a nicety, never a reason to lose a recipe.
 */
export async function labelRecipe(
  recipe: LabelInput,
  existing: { title: string; description: string | null }[],
  { fetch, apiKey }: LabelRecipeDeps,
): Promise<RecipeLabels> {
  let out: { title?: unknown; description?: unknown; tags?: unknown } = {}
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LABEL_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${LABELING_PROMPT}\n\nThe user's existing recipes with a similar title (title — note):\n${formatExistingRecipes(similarRecipes(recipe.title, existing))}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: recipe.title,
              category: recipe.category,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
            }).slice(0, 12_000),
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`OpenAI ${response.status}`)
    const content = (await response.json()).choices?.[0]?.message?.content
    out = JSON.parse(content)
  } catch (error) {
    console.warn('[label-recipe] labelling failed, keeping defaults:', error)
  }

  const title = resolveTitle(out.title, recipe.title)
  return {
    title,
    description: resolveDescription(out.description, title),
    tags: resolveTags({ ...recipe, title, tags: out.tags }),
  }
}
