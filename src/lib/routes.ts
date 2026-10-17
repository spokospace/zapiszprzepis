/**
 * A single recipe page under the legacy prefix: /recipes/{slug} (one segment) —
 * not "/recipes", the owner's list. Kept so middleware can permanently 301 it to
 * the canonical /przepis/{slug} (E01-S03b).
 */
export const RECIPE_PAGE_RE = /^\/recipes\/[^/]+$/

/** The canonical public recipe page: /przepis/{slug} (one segment) — E01-S03b. */
export const PRZEPIS_PAGE_RE = /^\/przepis\/[^/]+$/

/** A public category listing: /kategoria/{value} (one segment) — E01-S09. */
const KATEGORIA_PAGE_RE = /^\/kategoria\/[^/]+$/

/**
 * The canonical path to a recipe. Encodes the slug once; the single place every
 * link builder goes through, so the URL shape changes in one spot (E01-S03b).
 */
export function recipePath(slug: string): string {
  return `/przepis/${encodeURIComponent(slug)}`
}

/**
 * Rewrite a legacy /recipes/{slug} path to its canonical /przepis/{slug} form
 * for the permanent redirect (E01-S03b). The slug segment is kept verbatim — it
 * is already URL-encoded in the request path, so (unlike recipePath) it must not
 * be re-encoded. Callers gate on RECIPE_PAGE_RE first.
 */
export function legacyRecipePathToCanonical(pathname: string): string {
  return '/przepis/' + pathname.slice('/recipes/'.length)
}

/**
 * Routes a guest may open without a session (E01-S02). Data visibility is RLS's
 * job. Both the canonical /przepis/{slug} and the legacy /recipes/{slug} are
 * public: the legacy path must be reachable so middleware can issue its 301
 * instead of bouncing the visitor to /login first (E01-S03b). The category
 * listings are linked from the guest's MENU drawer (E01-S09).
 */
export function isPublicRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    PRZEPIS_PAGE_RE.test(pathname) ||
    RECIPE_PAGE_RE.test(pathname) ||
    KATEGORIA_PAGE_RE.test(pathname)
  )
}
