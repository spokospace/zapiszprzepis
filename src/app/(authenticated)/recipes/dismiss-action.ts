'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'

/**
 * "Odrzuć" / "Wyczyść wszystkie" — remove a failed share from the notification
 * bell. For MVP we delete the failed `recipe_shares` row outright (no enum
 * migration): the share is abandoned by the user, the failure is captured
 * out-of-band via the author email, and mama just wants it gone. RLS scopes the
 * delete to the current user; the `status = 'failed'` guard prevents removing a
 * pending or completed share. Part of S-06 ("no shared request is silently lost").
 */
export async function dismissShare(shareId: number): Promise<void> {
  if (!Number.isInteger(shareId) || shareId <= 0) return

  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('recipe_shares')
    .delete()
    .eq('id', shareId)
    .eq('status', 'failed')
  if (error) {
    console.error('[dismiss] Failed to dismiss share:', error)
  }

  revalidatePath('/recipes')
}

export async function dismissAllFailedShares(): Promise<void> {
  const { supabase } = await requireUser()
  const { error } = await supabase
    .from('recipe_shares')
    .delete()
    .eq('status', 'failed')
    .is('recipe_id', null)
  if (error) {
    console.error('[dismiss] Failed to dismiss all shares:', error)
  }

  revalidatePath('/recipes')
}
