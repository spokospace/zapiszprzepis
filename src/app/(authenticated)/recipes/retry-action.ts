'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { inngest } from '@/inngest/client'
import { requireUser } from '@/lib/supabase/server'
import { detectSourceType } from '@/lib/detect-source-type'
import { getFullAccess } from '@/lib/full-access'
import { addRecipeErrorPath } from '@/lib/routes'
import { isStalePending } from '@/lib/share-staleness'

/**
 * "Ponów" — re-trigger extraction for a share whose automatic retries (Inngest
 * retries: 3) were exhausted and left it failed, or whose run stopped and left
 * it pending past STALE_PENDING_MS (#382). Resets the share to pending
 * and re-sends the recipe/extract event. Part of S-06 ("no shared request is
 * silently lost"). Called directly from the notification bell inside a
 * transition, so it takes a plain shareId rather than FormData and stays on the
 * current route (revalidate, no redirect) — the bell lives on every
 * authenticated screen, so a redirect would yank the user off the detail page.
 * The whole layout is revalidated because the bell badge, the home banner and
 * /powiadomienia (E01-S15) all read the same shares. The one exception to "no
 * redirect": a user without full access is sent to the access-code gate
 * (/dodaj?add_error=no_access), because a retry spends the same extraction
 * budget as adding (E02-S01 / audit C6).
 */
export async function retryShare(shareId: number): Promise<void> {
  if (!Number.isInteger(shareId) || shareId <= 0) return

  const { supabase, user } = await requireUser()

  // E02-S01 (#369): „Ponów" re-runs extraction, which needs full access just
  // like adding (add-recipe-action, refresh-action). Gate it before any write.
  if (!(await getFullAccess(supabase))) redirect(addRecipeErrorPath('no_access'))

  // RLS scopes recipe_shares to the current user.
  const { data: share } = await supabase
    .from('recipe_shares')
    .select('id, shared_url, share_intent, status, updated_at')
    .eq('id', shareId)
    .single()

  // Gone, still genuinely in progress, or a concurrent retry already moved it
  // off `failed` — nothing to do.
  if (!share || (share.status !== 'failed' && !isStalePending(share))) {
    revalidatePath('/', 'layout')
    return
  }

  const intent = (share.share_intent ?? {}) as { title?: string | null; text?: string | null }

  // Compare-and-swap: the guard above ran on the SELECT, so gate the UPDATE on
  // the state it saw. A concurrent "Ponów" that already flipped this share (and
  // so bumped `updated_at`) leaves us with zero rows — don't double-dispatch.
  const casUpdate = supabase
    .from('recipe_shares')
    .update({ status: 'pending', error_message: null })
    .eq('id', share.id)
    .eq('status', share.status)
  const { data: reset, error: resetError } = await (share.status === 'pending'
    ? casUpdate.eq('updated_at', share.updated_at)
    : casUpdate
  ).select('id')
  if (resetError) {
    console.error('[retry] Failed to reset share to pending:', resetError)
    revalidatePath('/', 'layout')
    return
  }
  if (!reset || reset.length === 0) {
    revalidatePath('/', 'layout')
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

  revalidatePath('/', 'layout')
}
