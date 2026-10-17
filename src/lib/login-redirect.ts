import { safeNext } from './safe-redirect'

/**
 * `/login`, carrying where to return afterwards when there is somewhere to go,
 * and the recipe a guest's heart asked to favorite (E01-S06: `&fav={id}`).
 */
export function loginPath(next?: string | null, favoriteRecipeId?: number): string {
  const query: string[] = []
  if (next) query.push(`next=${encodeURIComponent(next)}`)
  if (favoriteRecipeId) query.push(`fav=${favoriteRecipeId}`)
  return query.length ? `/login?${query.join('&')}` : '/login'
}

/** `/login` showing `error`, keeping a non-root `next` so a retry returns there. */
export function loginErrorPath(error: string, next?: string | null): string {
  const query = new URLSearchParams({ error })
  if (next && next !== '/') query.set('next', next)
  return `/login?${query.toString()}`
}

/**
 * The post-login destination from a raw `next` value (form field or query).
 * Empty → `fallback`; anything that does not resolve to our own origin → `/`
 * (safeNext's rule, unchanged).
 */
export function resolveLoginNext(raw: unknown, origin: string, fallback: string): string {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  return safeNext(raw.trim(), origin)
}
