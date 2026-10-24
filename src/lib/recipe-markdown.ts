import { parseIngredients, groupBySection, ingredientLine } from '@/lib/ingredients'
import { parseSteps } from '@/lib/steps'
import { sourceLabel, originalLinkLabel, type RecipeSource } from '@/lib/recipe-source'
import { buildFallbackMetaDescription } from '@/lib/recipe-tags'
import { recipePath } from '@/lib/routes'

/** The guest-safe recipe fields the Markdown rendering needs (a public_recipes row). */
export interface RecipeForMarkdown {
  slug: string
  title: string
  description: string | null
  meta_description?: string | null
  ingredients: unknown
  steps: unknown
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  servings: number | null
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  youtube_id: string | null
}

/** The one-line meta: times, servings and source, each part dropped when absent. */
function metaLine(recipe: RecipeForMarkdown): string {
  const parts: string[] = []
  if (recipe.total_time_minutes) parts.push(`Czas całkowity: ${recipe.total_time_minutes} min`)
  else {
    if (recipe.prep_time_minutes) parts.push(`Przygotowanie: ${recipe.prep_time_minutes} min`)
    if (recipe.cook_time_minutes) parts.push(`Gotowanie: ${recipe.cook_time_minutes} min`)
  }
  if (recipe.servings) parts.push(`Porcje: ${recipe.servings}`)
  parts.push(`Źródło: ${sourceLabel(recipe.source_type, recipe.source_url, recipe.source_author)}`)
  return parts.join(' · ')
}

/** The canonical link to the original recipe, YouTube preferred when there's a video id. */
function originalUrl(recipe: RecipeForMarkdown): string | null {
  if (recipe.source_url) return recipe.source_url
  if (recipe.youtube_id) return `https://www.youtube.com/watch?v=${recipe.youtube_id}`
  return null
}

/**
 * A recipe as clean, quotable Markdown for AI/LLM readers — the body of
 * /przepis/{slug}.md. Fixed section order so citations are reproducible:
 * title, meta line, description, ## Składniki (grouped by section), ##
 * Przygotowanie (numbered), then a footer linking the canonical HTML page and
 * the original source. Reads only guest-safe fields; no gallery, no owner data.
 */
export function recipeToMarkdown(recipe: RecipeForMarkdown, siteUrl: string): string {
  const out: string[] = [`# ${recipe.title}`, '', metaLine(recipe)]

  const description = recipe.description ?? recipe.meta_description ?? buildFallbackMetaDescription(recipe)
  if (description) out.push('', description)

  const groups = groupBySection(parseIngredients(recipe.ingredients))
  if (groups.length) {
    out.push('', '## Składniki')
    for (const group of groups) {
      if (group.section) out.push('', `### ${group.section}`)
      out.push('', ...group.items.map((ing) => `- ${ingredientLine(ing, { alt: true })}`))
    }
  }

  const steps = parseSteps(recipe.steps)
  if (steps.length) {
    out.push('', '## Przygotowanie', '', ...steps.map((step, i) => `${i + 1}. ${step}`))
  }

  const canonical = `${siteUrl}${recipePath(recipe.slug)}`
  out.push('', '---', '', `Przepis na [zapiszprzepis.pl](${canonical}).`)
  const original = originalUrl(recipe)
  if (original) out.push(`[${originalLinkLabel(recipe.source_type, original)}](${original})`)

  return out.join('\n') + '\n'
}
