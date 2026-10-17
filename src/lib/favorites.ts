import type { SupabaseClient } from '@supabase/supabase-js'

/** A recipe id from untrusted input (form field, client call): a positive safe integer, else null. */
export function parseRecipeId(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}

export type FavoriteResult = { ok: true } | { ok: false; error: 'invalid' | 'unauthenticated' | 'failed' }

/** Postgres unique_violation — adding a favorite that already exists is a success. */
export const UNIQUE_VIOLATION = '23505'

/** Add a favorite; one that already exists is the desired end state. Returns any other error. */
export async function insertFavorite(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
): Promise<{ code?: string; message: string } | null> {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, recipe_id: recipeId })
  return error && error.code !== UNIQUE_VIOLATION ? error : null
}

/** Which of `recipeIds` the user has in Ulubione (favorites is owner-only under RLS); empty on error. */
export async function getFavoriteIds(supabase: SupabaseClient, userId: string, recipeIds: number[]): Promise<Set<number>> {
  const { data, error } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId).in('recipe_id', recipeIds)
  if (error) console.error('[favorites] lookup failed:', error.message)
  return new Set((data ?? []).map((f) => f.recipe_id as number))
}
