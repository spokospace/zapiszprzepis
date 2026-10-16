import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUrl, sourceUrlPattern } from './url-normalize'

export type DedupResult =
  | { status: 'new'; normalizedUrl: string }
  | { status: 'completed'; slug: string; normalizedUrl: string }
  | { status: 'pending'; normalizedUrl: string }

/** Filter `column` to every key of the post `key` names (see sourceUrlPattern). */
function matchKey<Q extends { eq(column: string, value: string): Q; like(column: string, pattern: string): Q }>(
  query: Q,
  column: string,
  key: string,
): Q {
  const pattern = sourceUrlPattern(key)
  return pattern ? query.like(column, pattern) : query.eq(column, key)
}

/** The user's recipe stored under `key`, or under another key of the same post. */
export async function findRecipeBySourceUrl(
  supabase: SupabaseClient,
  userId: string,
  key: string,
): Promise<{ id: number; slug: string; title: string; category: string } | null> {
  const query = supabase.from('recipes').select('id, slug, title, category').eq('user_id', userId)
  const { data } = await matchKey(query, 'source_url', key).limit(1).maybeSingle()
  return data
}

export async function findExistingRecipeForUrl(
  supabase: SupabaseClient,
  userId: string,
  rawUrl: string,
): Promise<DedupResult> {
  const normalizedUrl = normalizeUrl(rawUrl)

  const existingRecipe = await findRecipeBySourceUrl(supabase, userId, normalizedUrl)
  if (existingRecipe) {
    return { status: 'completed', slug: existingRecipe.slug, normalizedUrl }
  }

  const shares = supabase.from('recipe_shares').select('id').eq('user_id', userId).eq('status', 'pending')
  const { data: pendingShare } = await matchKey(shares, 'shared_url', normalizedUrl).limit(1).maybeSingle()

  if (pendingShare) {
    return { status: 'pending', normalizedUrl }
  }

  return { status: 'new', normalizedUrl }
}
