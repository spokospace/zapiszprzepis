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

/**
 * Same ingredients, in any order, judged by name alone: two extractions of
 * one recipe read amounts and units differently ("1 szkl." vs "250 ml"), but
 * a variant swaps or adds an ingredient.
 */
export function sameIngredients(a: { name: string }[], b: { name: string }[]): boolean {
  const names = (list: { name: string }[]) => [...new Set(list.map((i) => i.name.trim().toLowerCase()))].sort().join('\n')
  return names(a) === names(b)
}

/**
 * The user's recipe that `recipe` repeats — same title, any casing, and the
 * same ingredients — or null. Catches a recipe saved from two different posts
 * when its author published it twice (a Page reposting its own post), which
 * no URL rule can tell apart.
 */
export async function findSameRecipe(
  supabase: SupabaseClient,
  userId: string,
  recipe: { title: string; ingredients: { name: string }[] },
): Promise<{ id: number; slug: string; title: string; category: string } | null> {
  // ilike, not eq, for the casing; its wildcards in the title are escaped.
  const title = recipe.title.trim().replace(/[\\%_]/g, (c) => '\\' + c)
  const { data } = await supabase
    .from('recipes')
    .select('id, slug, title, category, ingredients')
    .eq('user_id', userId)
    .ilike('title', title)
    .limit(20)
  const same = (data ?? []).find((r) => Array.isArray(r.ingredients) && sameIngredients(r.ingredients, recipe.ingredients))
  return same ? { id: same.id, slug: same.slug, title: same.title, category: same.category } : null
}

/** The user's recipe saved from the same author text (see fingerprintText), or null. */
export async function findRecipeBySourceFingerprint(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
): Promise<{ id: number; slug: string; title: string; category: string } | null> {
  const { data } = await supabase
    .from('recipes')
    .select('id, slug, title, category')
    .eq('user_id', userId)
    .eq('source_fingerprint', fingerprint)
    .maybeSingle()
  return data
}
