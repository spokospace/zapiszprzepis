/** A single recipe page: /recipes/{slug} (one segment) — not "/recipes", the owner's list. */
export const RECIPE_PAGE_RE = /^\/recipes\/[^/]+$/

/** Routes a guest may open without a session (E01-S02). Data visibility is RLS's job. */
export function isPublicRoute(pathname: string): boolean {
  return pathname === '/' || RECIPE_PAGE_RE.test(pathname)
}
