/**
 * „Ostatnio szukane” on the full-screen search (E01-S26): the last few queries,
 * kept per device in localStorage and never sent to the server. Pure helpers, so
 * the storage format is tested without a browser.
 */
export const RECENT_SEARCHES_KEY = 'zp-recent-searches'
export const RECENT_SEARCHES_MAX = 5

/** Defensive read: anything that is not a list of non-empty strings is no history. */
export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, RECENT_SEARCHES_MAX)
  } catch {
    return []
  }
}

/** `q` first, without an earlier copy of it (case-insensitive), at most five. */
export function addRecentSearch(list: string[], q: string): string[] {
  const term = q.trim()
  if (!term) return list
  const key = term.toLocaleLowerCase('pl')
  return [term, ...list.filter((v) => v.toLocaleLowerCase('pl') !== key)].slice(0, RECENT_SEARCHES_MAX)
}
