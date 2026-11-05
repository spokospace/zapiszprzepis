'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser } from '@/lib/supabase/user-check'
import { parseRecipeId, type FavoriteResult } from '@/lib/favorites'

/**
 * Remove a bookmark from a form on /ulubione, which is why it stays on the server; the hearts
 * save in the browser (`browserSession.setFavorite`). Idempotent: removing a missing favorite
 * is a success. RLS scopes it to the caller.
 */
export async function removeFavorite(rawRecipeId: unknown): Promise<FavoriteResult> {
  const recipeId = parseRecipeId(rawRecipeId)
  if (recipeId === null) return { ok: false, error: 'invalid' }

  const supabase = await createSupabaseServerClient()
  const { user, transient } = await checkUser(supabase, 'removeFavorite')
  if (!user) return { ok: false, error: transient ? 'failed' : 'unauthenticated' }

  const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('recipe_id', recipeId)
  if (error) {
    console.error('[favorites] remove failed', { code: error.code })
    return { ok: false, error: 'failed' }
  }

  revalidatePath('/ulubione')
  return { ok: true }
}
