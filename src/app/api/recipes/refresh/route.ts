import { type NextRequest, NextResponse } from 'next/server'
import { sendRecipeExtract } from '@/inngest/send'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser } from '@/lib/supabase/user-check'
import { queueRecipeRefresh } from '@/lib/recipe-refresh'
import { recipePath } from '@/lib/routes'
import { getFullAccess } from '@/lib/full-access'
import { extractionAllowed } from '@/lib/extraction-rate-limit'

/**
 * "Odśwież przepis": re-run extraction for an existing recipe and overwrite it in place
 * (force). Lets the user fix a recipe that extracted poorly without deleting and re-adding
 * (the normal add path dedups and would be a no-op). A plain form posts here, because a
 * page served as a file cannot answer a Server Action. Every outcome returns to the recipe,
 * whose toast reads the query.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData().catch(() => null)
  const slug = form?.get('slug')
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url), { status: 303 })
  if (typeof slug !== 'string' || !slug) return redirectTo('/')
  const back = (query: string) => redirectTo(`${recipePath(slug)}?${query}`)

  const supabase = await createSupabaseServerClient()
  const { user, transient } = await checkUser(supabase, 'refreshRecipe')
  // A session check that could not decide is a retryable failure, not a logout.
  if (!user && transient) return back('refresh_error=unavailable')
  if (!user) return redirectTo('/login')

  // E01-S11: re-extraction spends the same budget as adding, so it needs full access.
  if (!(await getFullAccess(supabase))) return back('refresh_error=no_access')

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, source_url')
    .eq('slug', slug)
    .eq('user_id', user.id)
    .single()

  // Nothing to re-extract from (e.g. a manually-created recipe without a URL).
  if (!recipe?.source_url) return back('refresh_error=1')

  // E02-S11-T04: each extraction is paid, so each account is capped.
  if (!(await extractionAllowed(user.id))) return back('refresh_error=rate_limited')

  // By row id: a link with several dishes shares one source_url, and only this row is rewritten.
  await queueRecipeRefresh(supabase, sendRecipeExtract, { userId: user.id, sourceUrl: recipe.source_url, recipeId: recipe.id })

  return back('refreshing=1')
}
