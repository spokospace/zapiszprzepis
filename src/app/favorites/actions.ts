'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { insertFavorite, parseRecipeId, type FavoriteResult } from '@/lib/favorites'

/** Bookmark a recipe for the signed-in user. Idempotent: an existing favorite is a success. */
export async function addFavorite(rawRecipeId: unknown): Promise<FavoriteResult> {
  const recipeId = parseRecipeId(rawRecipeId)
  if (recipeId === null) return { ok: false, error: 'invalid' }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  // Plain insert; a duplicate (double click, retried POST, auto-add after login)
  // is the desired end state, so unique_violation counts as success.
  const error = await insertFavorite(supabase, user.id, recipeId)
  if (error) {
    console.error('[favorites] add failed', { code: error.code })
    return { ok: false, error: 'failed' }
  }

  revalidatePath('/ulubione')
  return { ok: true }
}

/** Remove a bookmark. Idempotent: removing a missing favorite is a success. RLS scopes it to the caller. */
export async function removeFavorite(rawRecipeId: unknown): Promise<FavoriteResult> {
  const recipeId = parseRecipeId(rawRecipeId)
  if (recipeId === null) return { ok: false, error: 'invalid' }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('recipe_id', recipeId)
  if (error) {
    console.error('[favorites] remove failed', { code: error.code })
    return { ok: false, error: 'failed' }
  }

  revalidatePath('/ulubione')
  return { ok: true }
}
