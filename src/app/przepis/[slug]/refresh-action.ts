'use server'

import { redirect } from 'next/navigation'
import { sendRecipeExtract } from '@/inngest/send'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser, SessionCheckError } from '@/lib/supabase/user-check'
import { queueRecipeRefresh } from '@/lib/recipe-refresh'
import { recipePath } from '@/lib/routes'
import { getFullAccess } from '@/lib/full-access'

/**
 * "Odśwież przepis" — re-run extraction for an existing recipe and overwrite it
 * in place (force). Lets the user fix a recipe that extracted poorly without
 * deleting and re-adding (the normal add path dedups and would be a no-op).
 */
export async function refreshRecipe(formData: FormData): Promise<void> {
  const slug = formData.get('slug')
  if (typeof slug !== 'string' || !slug) return

  const supabase = await createSupabaseServerClient()
  const { user, transient } = await checkUser(supabase, 'refreshRecipe')
  // A session check that could not decide is a retryable failure, not a logout.
  if (!user && transient) throw new SessionCheckError()
  if (!user) {
    redirect('/login')
  }

  // E01-S11: re-extraction spends the same budget as adding, so it needs full access.
  if (!(await getFullAccess(supabase))) {
    redirect(`${recipePath(slug)}?refresh_error=no_access`)
  }

  const { data: recipe } = await supabase
    .from('recipes')
    .select('source_url')
    .eq('slug', slug)
    .eq('user_id', user.id)
    .single()

  if (!recipe?.source_url) {
    // Nothing to re-extract from (e.g. a manually-created recipe without a URL).
    redirect(`${recipePath(slug)}?refresh_error=1`)
  }

  await queueRecipeRefresh(supabase, sendRecipeExtract, { userId: user.id, sourceUrl: recipe.source_url })

  redirect(`${recipePath(slug)}?refreshing=1`)
}
