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

/**
 * A relative path cut into its parts, the query kept as raw `key=value` text, or
 * null when it points at another origin. Raw on purpose: re-serializing through
 * URLSearchParams turns a `/` in the query into `%2F`, which safeNext refuses.
 */
function splitPath(path: string): { base: string; pairs: string[]; hash: string } | null {
  try {
    if (new URL(path, PATH_BASE).origin !== PATH_BASE) return null
  } catch {
    return null
  }
  const hashAt = path.indexOf('#')
  const rest = hashAt === -1 ? path : path.slice(0, hashAt)
  const queryAt = rest.indexOf('?')
  return {
    base: queryAt === -1 ? rest : rest.slice(0, queryAt),
    pairs: queryAt === -1 ? [] : rest.slice(queryAt + 1).split('&').filter(Boolean),
    hash: hashAt === -1 ? '' : path.slice(hashAt),
  }
}

function joinPath({ base, pairs, hash }: { base: string; pairs: string[]; hash: string }): string {
  return `${base}${pairs.length ? `?${pairs.join('&')}` : ''}${hash}`
}

const isParam = (name: string) => (pair: string) => pair.split('=')[0] === name

/**
 * `/login?next=…&fav={id}` → the `next` the login forms carry: the raw `next`
 * (or `/`) with the intent appended. An invalid `fav`, or a `next` that is not a
 * relative path, leaves `next` untouched; the login actions still run safeNext.
 */
export function withFavoriteIntent(next: unknown, rawFav: unknown): string | undefined {
  const raw = typeof next === 'string' ? next : undefined
  const recipeId = parseRecipeId(rawFav)
  if (recipeId === null) return raw
  const parts = splitPath(raw?.trim() || '/')
  if (!parts) return raw
  parts.pairs = [...parts.pairs.filter((pair) => !isParam(FAVORITE_INTENT_PARAM)(pair)), `${FAVORITE_INTENT_PARAM}=${recipeId}`]
  return joinPath(parts)
}

/**
 * Login completion (E01-S06): add the favorite the guest asked for, then point
 * `next` at the toast (`fav_added`) instead of the intent. Never throws: a
 * favorite must never block signing in, so on failure the intent is just dropped.
 */
export async function applyFavoriteIntent(supabase: SupabaseClient, userId: string, next: string): Promise<string> {
  const parts = splitPath(next)
  const intent = parts?.pairs.find(isParam(FAVORITE_INTENT_PARAM))
  const recipeId = intent ? parseRecipeId(intent.slice(FAVORITE_INTENT_PARAM.length + 1)) : null
  if (!parts || recipeId === null) return next

  parts.pairs = parts.pairs.filter((pair) => !isParam(FAVORITE_INTENT_PARAM)(pair))
  try {
    const error = await insertFavorite(supabase, userId, recipeId)
    if (error) console.error('[favorites] login intent failed', { code: error.code })
    else parts.pairs.push(`${FAVORITE_ADDED_PARAM}=${recipeId}`)
  } catch (err) {
    console.error('[favorites] login intent threw', err instanceof Error ? err.message : err)
  }
  return joinPath(parts)
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
