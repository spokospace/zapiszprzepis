/**
 * A single recipe page under the legacy prefix: /recipes/{slug} (one segment) —
 * not "/recipes", the owner's list. Kept so middleware can permanently 301 it to
 * the canonical /przepis/{slug} (E01-S03b).
 */
export const RECIPE_PAGE_RE = /^\/recipes\/[^/]+$/

/** The canonical public recipe page: /przepis/{slug} (one segment) — E01-S03b. */
export const PRZEPIS_PAGE_RE = /^\/przepis\/[^/]+$/

/**
 * The canonical path to a recipe. Encodes the slug once; the single place every
 * link builder goes through, so the URL shape changes in one spot (E01-S03b).
 */
export function recipePath(slug: string, opts?: { from?: string | null }): string {
  const path = `/przepis/${encodeURIComponent(slug)}`
  // ?from names the list the visitor came from, for the list bar (E01-S07).
  return opts?.from ? `${path}?from=${encodeURIComponent(opts.from)}` : path
}

/** E01-S16 flips this when the category page /przepisy/{kategoria} ships. */
const CATEGORY_PAGES_LIVE = false
/** E01-S14 flips this when the public profile /u/{username} ships. */
const PROFILE_PAGES_LIVE = false

/**
 * The public list of one category, or null while that page does not exist yet,
 * so the recipe page never links to a 404 (E01-S07).
 */
export function categoryListPath(category: string): string | null {
  return CATEGORY_PAGES_LIVE ? `/przepisy/${encodeURIComponent(category)}` : null
}

/** A user's public profile, or null while profiles do not exist yet (E01-S07). */
export function profilePath(username: string | null | undefined): string | null {
  return PROFILE_PAGES_LIVE && username ? `/u/${encodeURIComponent(username)}` : null
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
 * instead of bouncing the visitor to /login first (E01-S03b).
 */
export function isPublicRoute(pathname: string): boolean {
  return pathname === '/' || PRZEPIS_PAGE_RE.test(pathname) || RECIPE_PAGE_RE.test(pathname)
}
