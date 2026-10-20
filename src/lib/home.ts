/**
 * "Często szukane" on the guest home (E01-S04). A curated list: there is no
 * search analytics to rank real queries yet.
 */
export const POPULAR_SEARCHES = ['sernik', 'pierogi', 'rosół', 'szarlotka', 'naleśniki', 'zupa pomidorowa'] as const

/** „Często szukane” with the recent queries already shown removed (case-insensitive, pl). */
export function popularMinusRecent(recent: readonly string[]): string[] {
  const seen = new Set(recent.map((term) => term.toLocaleLowerCase('pl')))
  return POPULAR_SEARCHES.filter((term) => !seen.has(term.toLocaleLowerCase('pl')))
}

/**
 * The signed-in home's H1. `vocative` is the user's name in the vocative case
 * ("Aniu") once E01-S12 provides it; unknown or blank falls back to a plain
 * greeting, never to a guessed or nominative form.
 */
export function homeGreeting(vocative: string | null | undefined): string {
  const name = vocative?.trim()
  return name ? `Dzień dobry, ${name}!` : 'Dzień dobry!'
}
