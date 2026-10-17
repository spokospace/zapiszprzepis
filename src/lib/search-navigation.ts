/**
 * Where a change of the "Moje przepisy" search should navigate, and how (#228).
 * `currentSearch` is the query string of the URL on screen (`?category=zupy&q=sał`).
 *
 * Starting a search pushes one history entry; refining or clearing it replaces that
 * entry, so Back leaves the search instead of stepping through every partial query
 * ("s", "sa", "sał"…). The other params (category, tag) are kept. Null when the query
 * would not change, so pressing Enter after the debounce does not reload the list.
 */
export function searchNavigation(
  currentSearch: string,
  query: string,
): { href: string; replace: boolean } | null {
  const params = new URLSearchParams(currentSearch)
  const current = params.get('q') ?? ''
  const next = query.trim()
  if (next === current) return null

  if (next) {
    params.set('q', next)
  } else {
    params.delete('q')
  }
  const search = params.toString()
  return { href: search ? `/recipes?${search}` : '/recipes', replace: current !== '' }
}
