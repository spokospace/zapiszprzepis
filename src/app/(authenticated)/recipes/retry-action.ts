'use server'

import { revalidatePath } from 'next/cache'
import { inngest } from '@/inngest/client'
import { requireUser } from '@/lib/supabase/server'
import { detectSourceType } from '@/lib/detect-source-type'

/**
 * "Ponów" — re-trigger extraction for a share whose automatic retries (Inngest
 * retries: 3) were exhausted and left it failed. Resets the share to pending
 * and re-sends the recipe/extract event. Part of S-06 ("no shared request is
 * silently lost"). Called directly from the notification bell inside a
 * transition, so it takes a plain shareId rather than FormData and stays on the
 * current route (revalidate, no redirect) — the bell lives on every
 * authenticated screen, so a redirect would yank the user off the detail page.
 */
export async function retryShare(shareId: number): Promise<void> {
  if (!Number.isInteger(shareId) || shareId <= 0) return

  const { supabase, user } = await requireUser()

  // RLS scopes recipe_shares to the current user.
  const { data: share } = await supabase
    .from('recipe_shares')
    .select('id, shared_url, share_intent, status')
    .eq('id', shareId)
    .single()

  // Gone, or a concurrent retry already moved it off `failed` — nothing to do.
  if (!share || share.status !== 'failed') {
    revalidatePath('/recipes')
    return
  }

  const intent = (share.share_intent ?? {}) as { title?: string | null; text?: string | null }

  // Compare-and-swap on status: the guard above ran on the SELECT, so gate the
  // UPDATE on `status = 'failed'` too. A concurrent "Ponów" that already flipped
  // this share to `pending` leaves us with zero rows — don't double-dispatch.
  const { data: reset, error: resetError } = await supabase
    .from('recipe_shares')
    .update({ status: 'pending', error_message: null })
    .eq('id', share.id)
    .eq('status', 'failed')
    .select('id')
  if (resetError) {
    console.error('[retry] Failed to reset share to pending:', resetError)
    revalidatePath('/recipes')
    return
  }
  if (!reset || reset.length === 0) {
    revalidatePath('/recipes')
    return
  }

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
    // Dispatch failed — put the share back to `failed` so it stays visible in
    // the bell instead of stranded in `pending` and silently lost (the NFR
    // this whole feature exists to uphold).
    console.error('[retry] Failed to re-trigger extraction:', error)
    await supabase
      .from('recipe_shares')
      .update({
        status: 'failed',
        error_message: 'Nie udało się ponowić przetwarzania. Spróbuj ponownie.',
      })
      .eq('id', share.id)
  }

  revalidatePath('/recipes')
}
