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
