'use server'

import { redirect } from 'next/navigation'
import { inngest } from '@/inngest/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser, SessionCheckError } from '@/lib/supabase/user-check'
import { detectSourceType } from '@/lib/detect-source-type'
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

  const { data: share } = await supabase
    .from('recipe_shares')
    .insert({
      user_id: user.id,
      shared_url: recipe.source_url,
      share_intent: { url: recipe.source_url },
      status: 'pending',
      attempts: 0,
    })
    .select()
    .single()

  if (share) {
    try {
      await inngest.send({
        name: 'recipe/extract',
        data: {
          shareId: share.id,
          sharedUrl: recipe.source_url,
          sourceType: detectSourceType(recipe.source_url),
          userId: user.id,
          force: true,
        },
      })
    } catch (error) {
      // Like the add flows: a share that was never queued is failed, not left
      // pending to block re-adding its link (#382).
      console.error('[refresh] Failed to trigger re-extraction:', error)
      await supabase
        .from('recipe_shares')
        .update({ status: 'failed', error_message: 'Failed to queue extraction' })
        .eq('id', share.id)
    }
  }

  redirect(`${recipePath(slug)}?refreshing=1`)
}
