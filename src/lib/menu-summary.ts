import type { SupabaseClient } from '@supabase/supabase-js'
import { getFullAccess } from '@/lib/full-access'

/**
 * What the MENU drawer needs about a signed-in user (E01-S09). A null count
 * means the query failed: the drawer hides that counter rather than showing a
 * confident 0.
 */
export type MenuSummary = {
  hasFullAccess: boolean
  myRecipesCount: number | null
  favoritesCount: number | null
}

async function countOwnRows(
  supabase: SupabaseClient,
  table: 'recipes' | 'favorites',
  userId: string,
): Promise<number | null> {
  // head: true transfers no rows, only the count. The explicit user_id filter
  // mirrors /recipes (defence in depth on top of owner-only RLS).
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    console.error(`[menu-summary] Failed to count ${table}:`, error)
    return null
  }
  return count ?? null
}

/** null for a guest: no "Moje" block, nothing to query. */
export async function getMenuSummary(supabase: SupabaseClient, user: { id: string } | null): Promise<MenuSummary | null> {
  if (!user) return null
  const [fullAccess, myRecipesCount, favoritesCount] = await Promise.all([
    getFullAccess(supabase),
    countOwnRows(supabase, 'recipes', user.id),
    countOwnRows(supabase, 'favorites', user.id),
  ])
  return { hasFullAccess: fullAccess, myRecipesCount, favoritesCount }
}
