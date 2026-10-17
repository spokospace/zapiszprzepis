import { locate, parseSnapshot, type ListKey } from './recipe-list-context'

export interface HeaderBackLink {
  href: string
  /** Visible text after the arrow: "Wróć", or "Wyniki" when coming back to search results. */
  text: string
  /** Accessible name; always starts with the visible text (WCAG 2.5.3 label in name). */
  ariaLabel: string
}

/** No list context (a new tab, a shared link): back to the start page. */
export const HEADER_BACK_FALLBACK: HeaderBackLink = {
  href: '/',
  text: 'Wróć',
  ariaLabel: 'Wróć na stronę główną',
}

/**
 * Where the mobile header's "← Wróć" on a recipe page goes (E01-S19, handoff
 * "Nagłówek (mobile, 1c)"): the list the visitor opened the recipe from — read
 * from the same `?from` key + sessionStorage snapshot as the list bar (E01-S07) —
 * and only while this recipe is actually in that snapshot.
 */
export function headerBackLink(from: ListKey | null, rawSnapshot: string | null, slug: string): HeaderBackLink {
  if (!from) return HEADER_BACK_FALLBACK
  const position = locate(parseSnapshot(rawSnapshot), slug)
  if (!position) return HEADER_BACK_FALLBACK
  if (from === 'szukaj') {
    return { href: position.href, text: 'Wyniki', ariaLabel: `Wyniki — wróć do listy: ${position.label}` }
  }
  return { href: position.href, text: 'Wróć', ariaLabel: `Wróć do listy: ${position.label}` }
}
