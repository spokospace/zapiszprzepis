import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { normalizeUrl } from './url-normalize'

type SupabaseSSRClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export type DedupResult =
  | { status: 'new'; normalizedUrl: string }
  | { status: 'completed'; slug: string; normalizedUrl: string }
  | { status: 'pending'; normalizedUrl: string }

export async function findExistingRecipeForUrl(
  supabase: SupabaseSSRClient,
  userId: string,
  rawUrl: string,
): Promise<DedupResult> {
  const normalizedUrl = normalizeUrl(rawUrl)

  const { data: existingRecipe } = await supabase
    .from('recipes')
    .select('slug')
    .eq('user_id', userId)
    .eq('source_url', normalizedUrl)
    .maybeSingle()

  if (existingRecipe) {
    return { status: 'completed', slug: existingRecipe.slug, normalizedUrl }
  }

  const { data: pendingShare } = await supabase
    .from('recipe_shares')
    .select('id')
    .eq('user_id', userId)
    .eq('shared_url', normalizedUrl)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingShare) {
    return { status: 'pending', normalizedUrl }
  }

  return { status: 'new', normalizedUrl }
}
