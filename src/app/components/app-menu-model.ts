import type { MenuSummary } from '@/lib/menu-summary'

/** Today's add flow; E01-S10 moves it to /dodaj. */
export const ADD_RECIPE_HREF = '/?tab=add'

/** The 3c code gate (E01-S11): the home page shows it in place of the add form until S10 builds /dodaj. */
export const ACCESS_GATE_HREF = '/'

export type MineEntryKey = 'my-recipes' | 'favorites' | 'add'

export type MineEntry = {
  key: MineEntryKey
  href: string
  label: string
  /** null = no counter shown (not counted, or the count failed). */
  count: number | null
  /** No full access: padlock + "Wymaga kodu lub pełnego dostępu". */
  locked: boolean
}

export type MenuModel = {
  /** The "Moje" block; null for a guest, who gets "Zaloguj się / Załóż konto" instead. */
  mine: MineEntry[] | null
  /** "Ustawienia | Wyloguj" — signed-in only. */
  showAccountFooter: boolean
}

/**
 * What the MENU drawer shows for a given access state (E01-S09). `summary` is
 * undefined where the page did not load it (the home page until E01-S04 wires
 * it): the drawer then keeps today's capabilities — full access, no counters —
 * rather than showing a lock or a zero it cannot back up.
 */
export function buildMenuModel({
  isAuthenticated,
  summary,
}: {
  isAuthenticated: boolean
  summary?: MenuSummary | null
}): MenuModel {
  if (!isAuthenticated) return { mine: null, showAccountFooter: false }

  const fullAccess = summary?.hasFullAccess ?? true
  const mine: MineEntry[] = []
  if (fullAccess) {
    mine.push({
      key: 'my-recipes',
      href: '/recipes',
      label: 'Moje przepisy',
      count: summary?.myRecipesCount ?? null,
      locked: false,
    })
  }
  mine.push(
    { key: 'favorites', href: '/ulubione', label: 'Ulubione', count: summary?.favoritesCount ?? null, locked: false },
    {
      key: 'add',
      href: fullAccess ? ADD_RECIPE_HREF : ACCESS_GATE_HREF,
      label: 'Dodaj przepis',
      count: null,
      locked: !fullAccess,
    },
  )
  return { mine, showAccountFooter: true }
}

/** "1 przepis", "3 przepisy", "5 przepisów", "22 przepisy", "12 przepisów". */
export function recipesNoun(count: number): string {
  if (count === 1) return 'przepis'
  const lastDigit = count % 10
  const lastTwo = count % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'przepisy'
  return 'przepisów'
}
