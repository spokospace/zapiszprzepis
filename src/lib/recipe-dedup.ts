import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUrl, sourceUrlPattern } from './url-normalize'

export type DedupResult =
  | { status: 'new'; normalizedUrl: string }
  | { status: 'completed'; slug: string; normalizedUrl: string }
  | { status: 'pending'; normalizedUrl: string }
  // Someone else added this link first: one recipe per link (E01-S03a), so it
  // goes to the user's favorites instead of being extracted again.
  | { status: 'other'; recipeId: number; slug: string; normalizedUrl: string }

/** Whose recipe a link already is: nobody's, the user's own, or someone else's. */
export type ExistingOwner = 'none' | 'own' | 'other'

/** The user's own match wins over a site-wide one; shared by every intake path. */
export function classifyExisting({ ownMatch, globalMatch }: { ownMatch: boolean; globalMatch: boolean }): ExistingOwner {
  if (ownMatch) return 'own'
  if (globalMatch) return 'other'
  return 'none'
}

/** Filter `column` to every key of the post `key` names (see sourceUrlPattern). */
export function matchKey<Q extends { eq(column: string, value: string): Q; like(column: string, pattern: string): Q }>(
  query: Q,
  column: string,
  key: string,
): Q {
  const pattern = sourceUrlPattern(key)
  return pattern ? query.like(column, pattern) : query.eq(column, key)
}

type SavedRecipe = { id: number; slug: string; title: string; category: string; user_id: string }

/**
 * The recipe stored under `key`, or under another key of the same post: the
 * user's own when `userId` is given, else anyone's. The site-wide form needs a
 * client that reads every row (the Inngest service key) — under a user session
 * `recipes` is owner-only, which is what public_recipes is for.
 */
export async function findRecipeBySourceUrl(
  supabase: SupabaseClient,
  userId: string | null,
  key: string,
): Promise<SavedRecipe | null> {
  const query = supabase.from('recipes').select('id, slug, title, category, user_id')
  const scoped = userId ? query.eq('user_id', userId) : query
  const { data } = await matchKey(scoped, 'source_url', key).limit(1).maybeSingle()
  return data
}

/** Any user's recipe stored under `key`, read through the guest-safe view. */
export async function findPublicRecipeBySourceUrl(
  supabase: SupabaseClient,
  key: string,
): Promise<{ id: number; slug: string } | null> {
  const query = supabase.from('public_recipes').select('id, slug')
  const { data } = await matchKey(query, 'source_url', key).limit(1).maybeSingle()
  return data
}

export async function findExistingRecipeForUrl(
  supabase: SupabaseClient,
  userId: string,
  rawUrl: string,
): Promise<DedupResult> {
  const normalizedUrl = normalizeUrl(rawUrl)

  const own = await findRecipeBySourceUrl(supabase, userId, normalizedUrl)
  const other = own ? null : await findPublicRecipeBySourceUrl(supabase, normalizedUrl)

  const owner = classifyExisting({ ownMatch: own != null, globalMatch: other != null })
  if (owner === 'own' && own) return { status: 'completed', slug: own.slug, normalizedUrl }
  if (owner === 'other' && other) return { status: 'other', recipeId: other.id, slug: other.slug, normalizedUrl }

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
 * The recipe that `recipe` repeats — same title, any casing, and the same
 * ingredients — or null; the user's own when `userId` is given, else anyone's,
 * preferring `preferUserId`'s. Catches a recipe saved from two different posts
 * when its author published it twice (a Page reposting its own post), which
 * no URL rule can tell apart.
 */
export async function findSameRecipe(
  supabase: SupabaseClient,
  userId: string | null,
  recipe: { title: string; ingredients: { name: string }[] },
  preferUserId?: string,
): Promise<SavedRecipe | null> {
  // ilike, not eq, for the casing; its wildcards in the title are escaped.
  const title = recipe.title.trim().replace(/[\\%_]/g, (c) => '\\' + c)
  const sameIn = async (ownerId: string | null) => {
    const query = supabase.from('recipes').select('id, slug, title, category, user_id, ingredients')
    const { data } = await (ownerId ? query.eq('user_id', ownerId) : query).ilike('title', title).limit(50)
    return (data ?? []).filter((r) => Array.isArray(r.ingredients) && sameIngredients(r.ingredients, recipe.ingredients))
  }

  // The preferred user's own copy is looked up on its own first: one page of a
  // common title site-wide could leave it out and pass someone else's instead.
  const scopes = userId ? [userId] : preferUserId ? [preferUserId, null] : [null]
  for (const ownerId of scopes) {
    const same = await sameIn(ownerId)
    const match = same.find((r) => r.user_id === preferUserId) ?? same[0]
    if (match) return { id: match.id, slug: match.slug, title: match.title, category: match.category, user_id: match.user_id }
  }
  return null
}

/** The recipe saved from the same author text (see fingerprintText): the user's own when `userId` is given, else anyone's. */
export async function findRecipeBySourceFingerprint(
  supabase: SupabaseClient,
  userId: string | null,
  fingerprint: string,
): Promise<SavedRecipe | null> {
  const query = supabase.from('recipes').select('id, slug, title, category, user_id')
  const { data } = await (userId ? query.eq('user_id', userId) : query)
    .eq('source_fingerprint', fingerprint)
    .limit(1)
    .maybeSingle()
  return data
}
