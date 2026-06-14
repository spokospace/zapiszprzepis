'use server'

import { redirect } from 'next/navigation'
import { inngest } from '@/inngest/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { detectSourceType } from '@/lib/detect-source-type'

/**
 * "Odśwież przepis" — re-run extraction for an existing recipe and overwrite it
 * in place (force). Lets the user fix a recipe that extracted poorly without
 * deleting and re-adding (the normal add path dedups and would be a no-op).
 */
export async function refreshRecipe(formData: FormData): Promise<void> {
  const slug = formData.get('slug')
  if (typeof slug !== 'string' || !slug) return

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: recipe } = await supabase
    .from('recipes')
    .select('source_url')
    .eq('slug', slug)
    .eq('user_id', user.id)
    .single()

  if (!recipe?.source_url) {
    // Nothing to re-extract from (e.g. a manually-created recipe without a URL).
    redirect(`/recipes/${slug}?refresh_error=1`)
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
      console.error('[refresh] Failed to trigger re-extraction:', error)
    }
  }

  redirect(`/recipes/${slug}?refreshing=1`)
}
