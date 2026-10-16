import { safeNext } from './safe-redirect'

/** `/login`, carrying where to return afterwards when there is somewhere to go. */
export function loginPath(next?: string | null): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login'
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

/** Where a guest who tapped the heart comes back to: the recipe, asking to add it. */
export function favoriteReturnPath(slug: string): string {
  return `/recipes/${encodeURIComponent(slug)}?fav=1`
}
