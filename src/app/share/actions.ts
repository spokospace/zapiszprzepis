'use server'

import { sendRecipeExtract } from '@/inngest/send'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser, SessionCheckError } from '@/lib/supabase/user-check'
import { detectSourceType } from '@/lib/detect-source-type'
import { findExistingRecipeForUrl } from '@/lib/recipe-dedup'
import { favoriteExistingRecipe } from '@/lib/intake-favorite'
import { getFullAccess, NO_FULL_ACCESS } from '@/lib/full-access'
import { revalidatePath } from 'next/cache'

export type TriggerExtractionResult =
  | { duplicate: 'completed'; slug: string }
  | { duplicate: 'pending' }
  // Someone else added the link first; it is now in the user's favorites.
  | { duplicate: 'in_favorites'; slug: string }
  | { shareId: number; message: string }

export async function triggerRecipeExtraction(
  url: string,
  title?: string,
  text?: string
): Promise<TriggerExtractionResult> {
  const supabase = await createSupabaseServerClient()

  const { user, transient } = await checkUser(supabase, 'triggerRecipeExtraction')

  // Not 'Not authenticated': /share answers that with /login. An undecided check
  // falls through to its retryable "server" error next to the add form instead.
  if (!user && transient) throw new SessionCheckError()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const dedup = await findExistingRecipeForUrl(supabase, user.id, url)
  if (dedup.status === 'completed') {
    return { duplicate: 'completed', slug: dedup.slug }
  }
  if (dedup.status === 'pending') {
    return { duplicate: 'pending' }
  }
  if (dedup.status === 'other') {
    await favoriteExistingRecipe(supabase, user.id, dedup.recipeId, dedup.normalizedUrl)
    revalidatePath('/ulubione')
    return { duplicate: 'in_favorites', slug: dedup.slug }
  }

  // E01-S11: a NEW extraction needs full access (RLS refuses the insert too).
  // After dedup: an existing link only goes to favorites, which need no access.
  if (!(await getFullAccess(supabase))) {
    throw new Error(NO_FULL_ACCESS)
  }

  const sourceType = detectSourceType(url)

  const { data: share, error: shareError } = await supabase
    .from('recipe_shares')
    .insert({
      user_id: user.id,
      shared_url: dedup.normalizedUrl,
      share_intent: {
        url: dedup.normalizedUrl,
        title: title || null,
        text: text || null,
      },
      status: 'pending',
      attempts: 0,
    })
    .select()
    .single()

  if (shareError || !share) {
    throw new Error(`Failed to create share record: ${shareError?.message}`)
  }

  try {
    await sendRecipeExtract({
      shareId: share.id,
      sharedUrl: dedup.normalizedUrl,
      sharedTitle: title,
      sharedText: text,
      userId: user.id,
      sourceType,
    })
  } catch (error) {
    console.error('Failed to trigger extraction task:', error)
    // Mark the share as failed so it surfaces in the notification bell.
    // The row was already created above, so this update is always safe.
    await supabase
      .from('recipe_shares')
      .update({ status: 'failed', error_message: 'Failed to queue extraction' })
      .eq('id', share.id)
  }

  return {
    shareId: share.id,
    message: 'Zapisałem — przepis pojawi się za chwilę',
  }
}
