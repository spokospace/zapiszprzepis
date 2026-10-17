/**
 * A single recipe page under the legacy prefix: /recipes/{slug} (one segment) —
 * not "/recipes", the owner's list. Kept so middleware can permanently 301 it to
 * the canonical /przepis/{slug} (E01-S03b).
 */
export const RECIPE_PAGE_RE = /^\/recipes\/[^/]+$/

/** The canonical public recipe page: /przepis/{slug} (one segment) — E01-S03b. */
export const PRZEPIS_PAGE_RE = /^\/przepis\/[^/]+$/

/** A public category listing: /przepisy/{kategoria} (one segment) — E01-S09, extended by E01-S16. */
const PRZEPISY_CATEGORY_RE = /^\/przepisy\/[^/]+$/

/** A public profile: /u/{username} (one segment) — E01-S14. */
export const PROFILE_PAGE_RE = /^\/u\/[^/]+$/

/**
 * The public listing of one category (E01-S09), shared by the MENU drawer and
 * the home category tiles (E01-S04) so both link the same URL — the route
 * E01-S16 extends with tag chips (`?tag=a,b`, AND) and paging (`?strona=N`).
 * Public on purpose: /recipes?category= is owner-only and would bounce a guest
 * to /login.
 */
export function categoryPath(category: string, opts?: { tags?: readonly string[]; page?: number }): string {
  const path = `/przepisy/${encodeURIComponent(category)}`
  const query: string[] = []
  // Tag values are ASCII slugs, so the comma stays readable instead of %2C.
  if (opts?.tags?.length) query.push(`tag=${opts.tags.map(encodeURIComponent).join(',')}`)
  if (opts?.page && opts.page > 1) query.push(`strona=${opts.page}`)
  return query.length ? `${path}?${query.join('&')}` : path
}

/**
 * The canonical path to a recipe. Encodes the slug once; the single place every
 * link builder goes through, so the URL shape changes in one spot (E01-S03b).
 */
export function recipePath(slug: string, opts?: { from?: string | null }): string {
  const path = `/przepis/${encodeURIComponent(slug)}`
  // ?from names the list the visitor came from, for the list bar (E01-S07).
  return opts?.from ? `${path}?from=${encodeURIComponent(opts.from)}` : path
}

/** A user's public profile /u/{username} (E01-S14), or null without a username (e.g. a deleted account). */
export function profilePath(username: string | null | undefined): string | null {
  return username ? `/u/${encodeURIComponent(username)}` : null
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
 * listings are linked from the guest's MENU drawer (E01-S09), the profiles
 * from every recipe's author line (E01-S14).
 */
export function isPublicRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    PRZEPIS_PAGE_RE.test(pathname) ||
    RECIPE_PAGE_RE.test(pathname) ||
    PRZEPISY_CATEGORY_RE.test(pathname) ||
    PROFILE_PAGE_RE.test(pathname) ||
    pathname === SEARCH_PATH
  )
}

/** The public search results page (E01-S05); the home form submits a GET here with `q`. */
export const SEARCH_PATH = '/szukaj'

/** "Szukaj w:" — whose recipes a search covers. `moje` and `ulubione` need a session. */
export const SEARCH_SCOPES = ['wszystkie', 'moje', 'ulubione'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

/**
 * A search for `query` (trimmed) in `scope`, showing `page` pages of results.
 * Defaults are left out so links stay short and canonical; a blank query is
 * the bare search page (still keeping the scope).
 */
export function searchPath(query: string, scope: SearchScope = 'wszystkie', page = 1): string {
  const params = new URLSearchParams()
  const q = query.trim()
  if (q) params.set('q', q)
  if (scope !== 'wszystkie') params.set('zakres', scope)
  if (page > 1) params.set('strona', String(page))
  const qs = params.toString()
  return qs ? `${SEARCH_PATH}?${qs}` : SEARCH_PATH
}

/** The full-screen notifications page (E01-S15). */
export const NOTIFICATIONS_PATH = '/powiadomienia'
