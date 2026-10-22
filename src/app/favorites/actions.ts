'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkUser } from '@/lib/supabase/user-check'
import { insertFavorite, parseRecipeId, type FavoriteResult } from '@/lib/favorites'

/**
 * The signed-in caller, or the failure to return: `unauthenticated` for a real
 * guest, `failed` (retryable) when the session check could not decide.
 */
async function caller(where: string) {
  const supabase = await createSupabaseServerClient()
  const { user, transient } = await checkUser(supabase, where)
  if (user) return { supabase, user }
  const failure: FavoriteResult = { ok: false, error: transient ? 'failed' : 'unauthenticated' }
  return failure
}

/** Bookmark a recipe for the signed-in user. Idempotent: an existing favorite is a success. */
export async function addFavorite(rawRecipeId: unknown): Promise<FavoriteResult> {
  const recipeId = parseRecipeId(rawRecipeId)
  if (recipeId === null) return { ok: false, error: 'invalid' }

  const c = await caller('addFavorite')
  if (!('user' in c)) return c
  const { supabase, user } = c

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

  const c = await caller('removeFavorite')
  if (!('user' in c)) return c
  const { supabase, user } = c

  const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('recipe_id', recipeId)
  if (error) {
    console.error('[favorites] remove failed', { code: error.code })
    return { ok: false, error: 'failed' }
  }

  revalidatePath('/ulubione')
  return { ok: true }
}
