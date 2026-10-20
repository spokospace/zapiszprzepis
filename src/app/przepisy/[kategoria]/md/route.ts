import { isRecipeCategory } from '@/lib/recipe-categories'
import { categoryToMarkdown, type CategoryRecipeForMarkdown } from '@/lib/category-markdown'
import { listCanonicalRecipesByCategory } from '@/lib/public-recipe'
import { markdownResponse } from '@/lib/md-response'
import { getSiteUrl } from '@/lib/site-url'
import { categoryPath } from '@/lib/routes'

/**
 * GET /przepisy/{kategoria}.md (reached via the middleware `.md` rewrite) — the
 * category's recipes as Markdown, newest first, each linking its own `.md`.
 * noindex; the Link header points back to the HTML listing. Phase 2 of #363.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ kategoria: string }> }) {
  const { kategoria } = await params
  if (!isRecipeCategory(kategoria)) {
    return new Response('Nie znaleziono kategorii.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const [canonical, site] = await Promise.all([listCanonicalRecipesByCategory(kategoria), getSiteUrl()])
  // Oldest-wins from the shared reader; reverse for newest-first display.
  const recipes: CategoryRecipeForMarkdown[] = [...canonical]
    .reverse()
    .map((r) => ({ slug: r.slug, title: r.title ?? r.slug }))

  return markdownResponse(categoryToMarkdown(kategoria, recipes, site), {
    canonical: `${site}${categoryPath(kategoria)}`,
  })
}
