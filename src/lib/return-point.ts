import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { SEARCH_PATH } from '@/lib/routes'

/**
 * The „punkt powrotu” behind a recipe page's „← Wróć” (handoff 13, §3): the last
 * screen the visitor browsed *from* — a category list, Ulubione, Moje przepisy, a
 * search result or the start page. Recipe pages never set it, so walking through
 * „Podobne”, „Poprzedni” or „Następny” does not move it and „Wróć” skips the recipes
 * visited on the way.
 */
export interface ReturnPoint {
  href: string
  label: string
}

/** sessionStorage key, per tab. */
export const RETURN_POINT_KEY = 'returnPoint'

/** Where „Wróć” leads on a recipe page when no point was recorded (a shared link, a new tab). */
export const HOME_RETURN_POINT: ReturnPoint = { href: '/', label: 'Strona główna' }

const CATEGORY_PATH_RE = /^\/przepisy\/([^/]+)$/

/**
 * The return point for a screen, or null when the screen is not one to return to
 * (a recipe, settings, notifications, the empty search screen, …). `search` is the
 * query string with or without the leading „?”.
 */
export function returnPointFor(pathname: string, search: string): ReturnPoint | null {
  const query = search.replace(/^\?/, '')
  const withQuery = (path: string) => (query ? `${path}?${query}` : path)

  if (pathname === '/') return HOME_RETURN_POINT
  if (pathname === '/ulubione') return { href: withQuery(pathname), label: 'Ulubione' }
  if (pathname === '/recipes') return { href: withQuery(pathname), label: 'Moje przepisy' }
  if (pathname === SEARCH_PATH) {
    // The empty search screen has no results to come back to.
    return new URLSearchParams(query).get('q')?.trim() ? { href: withQuery(pathname), label: 'Wyniki' } : null
  }
  const category = CATEGORY_PATH_RE.exec(pathname)?.[1]
  if (category) {
    const slug = decodeURIComponent(category)
    const known = RECIPE_CATEGORIES.find((c) => c.value === slug)
    return known ? { href: withQuery(pathname), label: known.label } : null
  }
  return null
}

/** Reads what was stored; anything malformed, or not a same-site path, is no return point. */
export function parseReturnPoint(raw: string | null): ReturnPoint | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { href, label } = value as Record<string, unknown>
    if (typeof href !== 'string' || typeof label !== 'string' || !label) return null
    // A path on this site only: never a protocol-relative or absolute URL.
    if (!href.startsWith('/') || href.startsWith('//')) return null
    return { href, label }
  } catch {
    return null
  }
}

export function serializeReturnPoint(point: ReturnPoint): string {
  return JSON.stringify(point)
}

/**
 * The target of „← Wróć” on a recipe page, or null for the plain „Wróć” (history back)
 * — also null until hydration, so server and first client render match. The recorded
 * point wins; then the list the recipe was opened from; then the start page.
 */
export function resolveRecipeBackTarget({
  onRecipe,
  hydrated,
  returnPoint,
  listTarget,
}: {
  onRecipe: boolean
  hydrated: boolean
  returnPoint: ReturnPoint | null
  listTarget: ReturnPoint | null
}): ReturnPoint | null {
  if (!onRecipe || !hydrated) return null
  return returnPoint ?? listTarget ?? HOME_RETURN_POINT
}
