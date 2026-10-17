// Labelling: a second, small LLM pass over an already-extracted recipe that
// sets the presentation fields — the title's casing, the distinguishing note
// and the tags. Kept apart from extraction for two reasons:
//   - the backfill script labels stored recipes with the very same call, so
//     old and new recipes follow one set of rules;
//   - tagging needs judgement gpt-4o-mini lacked (it tagged bread rolls and
//     pizza "kruche"), while extraction is fine on the cheap model. The input
//     here is one recipe plus the user's similarly titled ones, so the bigger
//     model costs next to nothing.
import { LLM_TAGS, MAX_TAGS, META_DESCRIPTION_MAX, resolveTags, resolveDescription, resolveMetaDescription, stems, type RecipeTag } from '@/lib/recipe-tags'

export const LABEL_MODEL = 'gpt-4.1'

// Shared so the save-time labelling pass and the standalone meta-description
// generator (the migration generator) word the SEO sentence identically.
export const META_DESCRIPTION_RULE = `a single natural Polish sentence for search results and link previews, at most ${META_DESCRIPTION_MAX} characters (ideally 120–155), that says what the dish is and names its main ingredients or what makes it good. Full sentence, normal capitalisation, no hashtags, no quotes, no emoji; it may repeat words from the title. Base it only on this recipe's ingredients and steps — never invent anything. When the recipe has no steps (the method is in a video), describe the dish from its main ingredients instead.`

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
  metaDescription: string | null
  tags: RecipeTag[]
}

export interface LabelRecipeDeps {
  fetch: typeof globalThis.fetch
  apiKey: string | undefined
}

export const LABELING_PROMPT = `You label a saved Polish recipe. Return ONLY JSON: {"title": "...", "description": "...", "metaDescription": "...", "tags": [...]}.
- "title": the same title in Polish sentence case — a capital letter only at the start of each sentence and in proper names ("Bardzo Kruche Ciastka" → "Bardzo kruche ciastka", "Sernik Po Wiedeńsku" → "Sernik po wiedeńsku"; keep "Boże Narodzenie", "Pani Walewska", "Tiramisu", and a capital after "!", "?" or "."). Change only letter case — never add, drop or reword anything.
- "description": 2–5 words in Polish, lowercase, naming what sets THIS recipe apart from other recipes with a similar title — a key ingredient or technique taken from ITS ingredients and steps (e.g. "na ugotowanych żółtkach", "bez jajek", "z masłem orzechowym"). Never invent an ingredient that is not in the recipe. Never repeat or rephrase words already in the title. If the user already has recipes with a similar title (listed at the end), pick a feature that differs from their notes.
- "metaDescription": ALWAYS write one — ${META_DESCRIPTION_RULE}
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

/** The shared OpenAI JSON call for the labelling model (POST, json_object, 30s
 *  timeout). Returns the parsed message content; throws on a non-2xx response.
 *  Exported so the dish classifier (recipe-dish.ts) shares one call shape. */
export async function postChatJson(
  messages: { role: string; content: string }[],
  temperature: number,
  { fetch, apiKey }: LabelRecipeDeps,
): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LABEL_MODEL, temperature, response_format: { type: 'json_object' }, messages }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`OpenAI ${response.status}`)
  return JSON.parse((await response.json()).choices?.[0]?.message?.content)
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
  let out: { title?: unknown; description?: unknown; metaDescription?: unknown; tags?: unknown } = {}
  try {
    out = (await postChatJson(
      [
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
      0,
      { fetch, apiKey },
    )) as { title?: unknown; description?: unknown; metaDescription?: unknown; tags?: unknown }
  } catch (error) {
    console.warn('[label-recipe] labelling failed, keeping defaults:', error)
  }

  const title = resolveTitle(out.title, recipe.title)
  return {
    title,
    description: resolveDescription(out.description, title),
    metaDescription: resolveMetaDescription(out.metaDescription),
    tags: resolveTags({ ...recipe, title, tags: out.tags }),
  }
}

export type MetaDescriptionInput = Pick<LabelInput, 'title' | 'category' | 'ingredients' | 'steps'>

export const META_DESCRIPTION_PROMPT = `You write the SEO meta description for a saved Polish recipe. Return ONLY JSON: {"metaDescription": "..."}.
Write ${META_DESCRIPTION_RULE}
A "sourceDescription" may be given below — the description the source page uses. NEVER copy it word for word or lightly reword it: always write your OWN sentence from the recipe's ingredients and steps. Use the source only as a hint to what the dish is; reuse no distinctive phrase from it. If it is generic site/blog boilerplate, a cookie or navigation notice, or unrelated to this dish, ignore it entirely.`

/** Letters and digits only, lowercased — so "near-copy" ignores case, spacing
 *  and punctuation. */
function normalizeForCompare(text: string): string {
  return text.toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/**
 * Whether `candidate` is essentially a copy of `source` — identical once
 * normalised, or one wholly contains the other and they are close in length.
 * Guards the rule that a meta description must be rewritten, never lifted from
 * the source page verbatim.
 */
export function isNearCopy(candidate: string, source: string): boolean {
  const a = normalizeForCompare(candidate)
  const b = normalizeForCompare(source)
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return long.includes(short) && short.length >= long.length * 0.8
}

async function callMetaDescription(
  recipe: MetaDescriptionInput,
  sourceDescription: string | null | undefined,
  { fetch, apiKey }: LabelRecipeDeps,
): Promise<string | null> {
  const out = (await postChatJson(
    [
      { role: 'system', content: META_DESCRIPTION_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          title: recipe.title,
          category: recipe.category,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          sourceDescription: sourceDescription?.trim() || undefined,
        }).slice(0, 12_000),
      },
    ],
    0.2,
    { fetch, apiKey },
  )) as { metaDescription?: unknown }
  return resolveMetaDescription(out.metaDescription)
}

/**
 * One LLM sentence describing a recipe, for a one-off meta-description backfill.
 * When `sourceDescription` is given (the source page's own og:description /
 * meta description) it is a hint only — the sentence is always written fresh,
 * never copied. If the model returns something too close to the source it is
 * retried without the hint; if that still echoes it, we return null so the
 * caller falls back to a self-derived sentence (which cannot be a source copy).
 * Never throws.
 */
export async function generateMetaDescription(
  recipe: MetaDescriptionInput,
  { sourceDescription, fetch, apiKey }: LabelRecipeDeps & { sourceDescription?: string | null },
): Promise<string | null> {
  // Try with the source hint first; if the model echoes it, retry without the
  // hint so it cannot copy. Falling through to null lets the caller use its own
  // self-derived sentence, which can never be a source copy.
  try {
    for (const hint of sourceDescription ? [sourceDescription, null] : [null]) {
      const out = await callMetaDescription(recipe, hint, { fetch, apiKey })
      if (out && !(sourceDescription && isNearCopy(out, sourceDescription))) return out
    }
    return null
  } catch (error) {
    console.warn('[meta-description] generation failed:', error)
    return null
  }
}
