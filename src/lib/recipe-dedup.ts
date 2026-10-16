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

/** Unique, trimmed, lower-cased ingredient names — the set two extractions are compared on. */
export function ingredientNames(list: { name: string }[]): Set<string> {
  return new Set(list.map((i) => i.name.trim().toLowerCase()).filter((n) => n.length > 0))
}

/**
 * Same ingredients, in any order, judged by name alone: two extractions of
 * one recipe read amounts and units differently ("1 szkl." vs "250 ml"), but
 * a variant swaps or adds an ingredient.
 */
export function sameIngredients(a: { name: string }[], b: { name: string }[]): boolean {
  const [x, y] = [ingredientNames(a), ingredientNames(b)]
  return x.size === y.size && [...x].every((n) => y.has(n))
}

// A shorter list than this is too generic to call two same-titled posts one
// recipe on a strict-subset overlap alone — "mąka, cukier, jajka" is half the
// desserts on the site. Equal lists are exempt: they are already one recipe.
const MIN_SUBSUME_NAMES = 3

/**
 * One recipe, extracted twice at different completeness: the shorter
 * ingredient list's names are all present in the longer. A Facebook caption
 * that truncated the cream's ingredients and the full blog version of the same
 * cake read as two recipes under `sameIngredients` (exact set equality) — the
 * duplicate the global URL/fingerprint rules can't catch, because the two
 * posts carry different links and different caption text. Equal lists match at
 * any size (this subsumes `sameIngredients`); a STRICT subset must have at
 * least MIN_SUBSUME_NAMES names behind it, so a stub recipe does not subsume
 * every longer one that happens to share its title.
 */
export function ingredientsSubsume(a: { name: string }[], b: { name: string }[]): boolean {
  const [x, y] = [ingredientNames(a), ingredientNames(b)]
  const [small, big] = x.size <= y.size ? [x, y] : [y, x]
  if (small.size === 0) return false
  if (small.size < big.size && small.size < MIN_SUBSUME_NAMES) return false
  return [...small].every((n) => big.has(n))
}

/**
 * The recipe that `recipe` repeats — same title, any casing, and ingredients
 * that subsume one another (one extraction a subset of the other) — or null;
 * the user's own when `userId` is given, else anyone's, preferring
 * `preferUserId`'s. Catches a recipe saved from two different posts when its
 * author published it twice (a Page reposting its own post), which no URL rule
 * can tell apart.
 */
export async function findSameRecipe(
  supabase: SupabaseClient,
  userId: string | null,
  recipe: { title: string; ingredients: { name: string }[] },
  preferUserId?: string,
): Promise<SavedRecipe | null> {
  // ilike, not eq, for the casing; its wildcards in the title are escaped.
  const title = recipe.title.trim().replace(/[\\%_]/g, (c) => '\\' + c)
  const query = supabase.from('recipes').select('id, slug, title, category, user_id, ingredients')
  const { data } = await (userId ? query.eq('user_id', userId) : query).ilike('title', title).limit(50)
  const same = (data ?? []).filter((r) => Array.isArray(r.ingredients) && ingredientsSubsume(r.ingredients, recipe.ingredients))
  const match = same.find((r) => r.user_id === preferUserId) ?? same[0]
  return match
    ? { id: match.id, slug: match.slug, title: match.title, category: match.category, user_id: match.user_id }
    : null
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
