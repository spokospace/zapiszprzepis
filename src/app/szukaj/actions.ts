'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { suggestRecipes, type RecipeSuggestion } from '@/lib/search'

/**
 * Type-ahead for the /szukaj field (E01-S29). Public like the search itself: a
 * guest gets suggestions too; the RPC only reads recipes everyone may see.
 */
export async function getSuggestions(q: unknown): Promise<RecipeSuggestion[]> {
  if (typeof q !== 'string') return []
  const supabase = await createSupabaseServerClient()
  return suggestRecipes(supabase, q)
}
