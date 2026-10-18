import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { mergedRecipeSlug } from '@/lib/merged-recipe-redirect'

/**
 * The slug a merged duplicate's link now lands on (see mergedRecipeSlug), read
 * with the service key: recipes_merged_duplicates is service-only. Null — a
 * plain 404 — when the key is not configured or the lookup fails.
 */
export async function findMergedRecipeSlug(slug: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return await mergedRecipeSlug(supabase, slug)
  } catch (err) {
    console.error('[recipe] Merged-slug lookup failed:', err)
    return null
  }
}
