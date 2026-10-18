import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUrl, sourceUrlPattern } from './url-normalize'
import { sha256Hex } from './sha256'

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

/** The columns a SavedRecipe is read from — shared by the by-URL, by-fingerprint and by-ingredient lookups. */
const SAVED_RECIPE_COLUMNS = 'id, slug, title, category, user_id'

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
  const query = supabase.from('recipes').select(SAVED_RECIPE_COLUMNS)
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

// Title-independent same-recipe signal. Two shares of one dish added seconds
// apart — a page reposting another's video, two videos of the same recipe —
// carry different links and different caption text (so the URL and fingerprint
// rules miss them) AND the LLM names them differently from the two captions
// ("Kanapki z jajkiem i szynką" vs "Zapiekanka z szynką i serem" — the real
// #835/#836 pair), so the title+ingredient path below misses them too. Their
// one shared signal is an identical ingredient set. A set this size of specific
// names is a strong duplicate signal; a shorter list is pantry staples ("jajka,
// masło, sól") too generic to merge two differently-titled recipes on.
export const MIN_FINGERPRINT_NAMES = 5

/**
 * The canonical string for a recipe's ingredient set — distinct, normalized
 * names, sorted, newline-joined — or null when the set is too small to identify
 * a recipe across titles (see MIN_FINGERPRINT_NAMES). The in-memory grouping
 * key for the offline collapse; its hash (ingredientFingerprint) is what the
 * database stores and the intake looks up.
 */
export function ingredientKey(list: { name: string }[]): string | null {
  const names = [...ingredientNames(list)].sort()
  if (names.length < MIN_FINGERPRINT_NAMES) return null
  return names.join('\n')
}

/**
 * SHA-256 (hex) of ingredientKey, stored in recipes.ingredient_fingerprint so
 * the same ingredient set can be found by an indexed equality lookup. Null when
 * ingredientKey is (too few names).
 */
export async function ingredientFingerprint(list: { name: string }[]): Promise<string | null> {
  const key = ingredientKey(list)
  return key == null ? null : sha256Hex(key)
}

/**
 * The recipe with the same ingredient set (see ingredientFingerprint): the
 * user's own when `userId` is given, else anyone's, preferring `preferUserId`'s.
 */
export async function findRecipeByIngredientFingerprint(
  supabase: SupabaseClient,
  userId: string | null,
  fingerprint: string,
  preferUserId?: string,
): Promise<SavedRecipe | null> {
  const query = supabase.from('recipes').select(SAVED_RECIPE_COLUMNS)
  const { data } = await (userId ? query.eq('user_id', userId) : query).eq('ingredient_fingerprint', fingerprint).limit(50)
  const rows = (data ?? []) as SavedRecipe[]
  return rows.find((r) => r.user_id === preferUserId) ?? rows[0] ?? null
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
  // The same ingredient set, whatever the title: two shares of one dish added
  // close together that the LLM named differently (see MIN_FINGERPRINT_NAMES).
  // Checked first — it is one indexed lookup and catches what the title path
  // below cannot.
  const fingerprint = await ingredientFingerprint(recipe.ingredients)
  if (fingerprint) {
    const byIngredients = await findRecipeByIngredientFingerprint(supabase, userId, fingerprint, preferUserId)
    if (byIngredients) return byIngredients
  }

  // ilike, not eq, for the casing; its wildcards in the title are escaped.
  const title = recipe.title.trim().replace(/[\\%_]/g, (c) => '\\' + c)
  const sameIn = async (ownerId: string | null) => {
    const query = supabase.from('recipes').select('id, slug, title, category, user_id, ingredients')
    const { data } = await (ownerId ? query.eq('user_id', ownerId) : query).ilike('title', title).limit(50)
    return (data ?? []).filter((r) => Array.isArray(r.ingredients) && ingredientsSubsume(r.ingredients, recipe.ingredients))
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

/**
 * The recipe saved for the same YouTube video under another link: a blog post
 * that embeds the film, or the film itself. A video share matches any recipe
 * carrying its id; a page that only embeds the video matches the video's own
 * recipe, never another page embedding it too — a roundup can embed someone
 * else's film. Anyone's recipe: the site-wide form needs the service key.
 */
export async function findRecipeByYoutubeId(
  supabase: SupabaseClient,
  youtubeId: string,
  { fromVideo }: { fromVideo: boolean },
): Promise<SavedRecipe | null> {
  const query = supabase.from('recipes').select(SAVED_RECIPE_COLUMNS).eq('youtube_id', youtubeId)
  const { data } = await (fromVideo ? query : query.eq('source_type', 'youtube'))
    .order('id')
    .limit(1)
    .maybeSingle()
  return data
}

/** The recipe saved from the same author text (see fingerprintText): the user's own when `userId` is given, else anyone's. */
export async function findRecipeBySourceFingerprint(
  supabase: SupabaseClient,
  userId: string | null,
  fingerprint: string,
): Promise<SavedRecipe | null> {
  const query = supabase.from('recipes').select(SAVED_RECIPE_COLUMNS)
  const { data } = await (userId ? query.eq('user_id', userId) : query)
    .eq('source_fingerprint', fingerprint)
    .limit(1)
    .maybeSingle()
  return data
}
