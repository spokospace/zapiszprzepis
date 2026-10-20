import { listCanonicalRecipes } from '@/lib/public-recipe'
import { markdownResponse } from '@/lib/md-response'
import { getSiteUrl } from '@/lib/site-url'
import { RECIPE_CATEGORIES, categoryLabel } from '@/lib/recipe-categories'
import { recipePath, categoryPath } from '@/lib/routes'

/** Cap the recipe index so a large catalog can't bloat the file unboundedly. */
const RECIPE_CAP = 1000

/**
 * GET /llms.txt — the AI-readable index of the site (llmstxt.org convention):
 * an H1, a one-line summary, a Kategorie section and a Przepisy section, every
 * entry linking that page's `.md` alternate. Reads only guest-safe data.
 * Phase 2 of #363.
 */
export async function GET() {
  const site = await getSiteUrl()
  const out: string[] = [
    '# Zapisz Przepis',
    '',
    '> Katalog przepisów kulinarnych po polsku. Każdy przepis i każda kategoria ma wersję Markdown pod adresem z sufiksem `.md`.',
    '',
    '## Kategorie',
    '',
    ...RECIPE_CATEGORIES.map((c) => `- [${categoryLabel(c.value)}](${site}${categoryPath(c.value)}.md)`),
  ]

  try {
    // listCanonicalRecipes is oldest-first; reverse for newest-first in the index.
    const recipes = (await listCanonicalRecipes()).reverse()
    out.push('', '## Przepisy', '')
    for (const r of recipes.slice(0, RECIPE_CAP)) {
      out.push(`- [${r.title ?? r.slug}](${site}${recipePath(r.slug)}.md)`)
    }
    if (recipes.length > RECIPE_CAP) out.push('', `… i ${recipes.length - RECIPE_CAP} więcej.`)
  } catch {
    // Keep the Kategorie section even if the recipe read fails.
  }

  return markdownResponse(out.join('\n') + '\n')
}
