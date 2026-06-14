'use server'

import { redirect } from 'next/navigation'
import { inngest } from '@/inngest/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { detectSourceType } from '@/lib/detect-source-type'

/**
 * "Ponów" — re-trigger extraction for a share whose automatic retries (Inngest
 * retries: 3) were exhausted and left it failed. Resets the share to pending
 * and re-sends the recipe/extract event. Part of S-07 ("no shared request is
 * silently lost").
 */
export async function retryShare(formData: FormData): Promise<void> {
  const shareId = Number(formData.get('shareId'))
  if (!Number.isInteger(shareId) || shareId <= 0) return

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // RLS scopes recipe_shares to the current user.
  const { data: share } = await supabase
    .from('recipe_shares')
    .select('id, shared_url, share_intent, status')
    .eq('id', shareId)
    .single()

  if (!share || share.status !== 'failed') {
    redirect('/recipes')
  }

  const intent = (share.share_intent ?? {}) as { title?: string | null; text?: string | null }

  await supabase
    .from('recipe_shares')
    .update({ status: 'pending', error_message: null })
    .eq('id', share.id)

  try {
    await inngest.send({
      name: 'recipe/extract',
      data: {
        shareId: share.id,
        sharedUrl: share.shared_url,
        sharedTitle: intent.title ?? undefined,
        sharedText: intent.text ?? undefined,
        sourceType: detectSourceType(share.shared_url),
        userId: user.id,
      },
    })
  } catch (error) {
    console.error('[retry] Failed to re-trigger extraction:', error)
  }

  redirect('/recipes?retrying=1')
}
