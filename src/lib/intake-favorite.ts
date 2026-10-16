import type { SupabaseClient } from '@supabase/supabase-js'
import { insertFavorite } from './favorites'
import { matchKey } from './recipe-dedup'

/**
 * Someone else added this link first (E01-S03a, one recipe per link): put
 * their recipe in the user's favorites instead of extracting a copy, and
 * settle the user's earlier failed shares of the link on it so the bell stops
 * listing them. Runs under the user's session; RLS scopes both writes to them.
 */
export async function favoriteExistingRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  normalizedUrl: string,
): Promise<void> {
  const error = await insertFavorite(supabase, userId, recipeId)
  if (error) {
    throw new Error(`Failed to add favorite: ${error.message}`)
  }

  const failed = supabase
    .from('recipe_shares')
    .update({ recipe_id: recipeId, status: 'completed' })
    .eq('user_id', userId)
    .eq('status', 'failed')
  const { error: sharesError } = await matchKey(failed, 'shared_url', normalizedUrl)
  // The favorite is what the user asked for; a stale bell entry is not worth
  // failing the share over (getFailedShares also resolves favorited links).
  if (sharesError) console.error('[intake-favorite] Failed to settle failed shares:', sharesError.message)
}
