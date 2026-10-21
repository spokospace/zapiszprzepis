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
 * The home H1 (handoff 14): "Czego dziś szukasz, Aniu?". `vocative` is the user's
 * name in the vocative case (E01-S12); unknown or blank falls back to the guest's
 * "Czego dziś szukasz?", never to a guessed or nominative form.
 */
export function homeGreeting(vocative: string | null | undefined): string {
  const name = vocative?.trim()
  return name ? `Czego dziś szukasz, ${name}?` : 'Czego dziś szukasz?'
}
