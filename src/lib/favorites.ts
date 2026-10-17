import type { SupabaseClient } from '@supabase/supabase-js'

/** A recipe id from untrusted input (form field, client call): a positive safe integer, else null. */
export function parseRecipeId(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}

export type FavoriteResult = { ok: true } | { ok: false; error: 'invalid' | 'unauthenticated' | 'failed' }

/** Postgres unique_violation — adding a favorite that already exists is a success. */
export const UNIQUE_VIOLATION = '23505'

/** Add a favorite; one that already exists is the desired end state. Returns any other error. */
export async function insertFavorite(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
): Promise<{ code?: string; message: string } | null> {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, recipe_id: recipeId })
  return error && error.code !== UNIQUE_VIOLATION ? error : null
}

/**
 * The query param that carries a guest's "add this to favorites" through login
 * (E01-S06), and the one that tells the page it was added. Distinct from the
 * retired recipe-page `?fav=1`, so an old link can never favorite recipe #1.
 */
export const FAVORITE_INTENT_PARAM = 'add_fav'
export const FAVORITE_ADDED_PARAM = 'fav_added'

// Only for parsing relative paths; never leaves this module.
const PATH_BASE = 'http://path.invalid'

/** A relative path parsed as a URL, or null when it points at another origin. */
function parsePath(path: string): URL | null {
  try {
    const url = new URL(path, PATH_BASE)
    return url.origin === PATH_BASE ? url : null
  } catch {
    return null
  }
}

function toPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * `/login?next=…&fav={id}` → the `next` the login forms carry: the raw `next`
 * (or `/`) with the intent appended. An invalid `fav`, or a `next` that is not a
 * relative path, leaves `next` untouched; the login actions still run safeNext.
 */
export function withFavoriteIntent(next: string | undefined, rawFav: unknown): string | undefined {
  const recipeId = parseRecipeId(rawFav)
  if (recipeId === null) return next
  const url = parsePath(next?.trim() || '/')
  if (!url) return next
  url.searchParams.set(FAVORITE_INTENT_PARAM, String(recipeId))
  return toPath(url)
}

/**
 * Login completion (E01-S06): add the favorite the guest asked for, then point
 * `next` at the toast (`fav_added`) instead of the intent. Never throws: a
 * favorite must never block signing in, so on failure the intent is just dropped.
 */
export async function applyFavoriteIntent(supabase: SupabaseClient, userId: string, next: string): Promise<string> {
  const url = parsePath(next)
  const recipeId = url ? parseRecipeId(url.searchParams.get(FAVORITE_INTENT_PARAM)) : null
  if (!url || recipeId === null) return next

  url.searchParams.delete(FAVORITE_INTENT_PARAM)
  try {
    const error = await insertFavorite(supabase, userId, recipeId)
    if (error) console.error('[favorites] login intent failed', { code: error.code })
    else url.searchParams.set(FAVORITE_ADDED_PARAM, String(recipeId))
  } catch (err) {
    console.error('[favorites] login intent threw', err instanceof Error ? err.message : err)
  }
  return toPath(url)
}

/** Which of `recipeIds` the user has favorited, in one query per page of cards. Empty on error. */
export async function getFavoriteIds(
  supabase: SupabaseClient,
  userId: string,
  recipeIds: readonly number[],
): Promise<Set<number>> {
  if (recipeIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId)
    .in('recipe_id', [...recipeIds])
  if (error) {
    console.error('[favorites] lookup failed', { code: error.code })
    return new Set()
  }
  return new Set((data ?? []).map((row: { recipe_id: number }) => row.recipe_id))
}
