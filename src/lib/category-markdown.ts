import { categoryLabel, type RecipeCategory } from '@/lib/recipe-categories'
import { recipePath } from '@/lib/routes'

/** The guest-safe fields a category Markdown listing needs per recipe. */
export interface CategoryRecipeForMarkdown {
  slug: string
  title: string
}

/**
 * A category listing as Markdown for AI/LLM readers — the body of
 * /przepisy/{kategoria}.md: an H1 with the category label, a one-line summary,
 * then a bullet list of its recipes each linking that recipe's own `.md`.
 */
export function categoryToMarkdown(
  category: RecipeCategory,
  recipes: readonly CategoryRecipeForMarkdown[],
  siteUrl: string,
): string {
  const label = categoryLabel(category)
  const out: string[] = [`# Przepisy: ${label}`, '']

  if (recipes.length === 0) {
    out.push(`Brak przepisów w kategorii „${label}” w aplikacji Zapisz Przepis.`)
    return out.join('\n') + '\n'
  }

  out.push(`${recipes.length} przepisów w kategorii „${label}” w aplikacji Zapisz Przepis.`, '')
  for (const recipe of recipes) {
    out.push(`- [${recipe.title}](${siteUrl}${recipePath(recipe.slug)}.md)`)
  }
  return out.join('\n') + '\n'
}
