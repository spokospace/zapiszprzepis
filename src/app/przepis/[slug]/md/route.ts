import { canonicalRecipeBySlug } from '@/lib/public-recipe'
import { recipeToMarkdown } from '@/lib/recipe-markdown'
import { markdownResponse } from '@/lib/md-response'
import { getSiteUrl } from '@/lib/site-url'
import { recipePath } from '@/lib/routes'

/**
 * GET /przepis/{slug}.md (reached via the middleware `.md` rewrite) — the recipe
 * as quotable Markdown for AI/LLM readers. noindex so the HTML page stays the
 * indexed canonical; the Link header points back to it. Reads only the
 * guest-safe canonical (oldest-wins) row. Phase 2 of #363.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [recipe, site] = await Promise.all([canonicalRecipeBySlug(slug), getSiteUrl()])

  if (!recipe) {
    return new Response('Nie znaleziono przepisu.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return markdownResponse(recipeToMarkdown(recipe, site), { canonical: `${site}${recipePath(recipe.slug)}` })
}
