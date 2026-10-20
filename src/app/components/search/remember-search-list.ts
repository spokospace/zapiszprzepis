import { listStorageKey } from '@/lib/recipe-list-context'
import { searchPath } from '@/lib/routes'
import { writeSessionStorage } from '@/app/components/ui/use-session-storage'

/**
 * Remember the suggestion list behind a query, so a recipe opened from it leads
 * back „← Wyniki” to that query's results (E01-S28). Shared by the /szukaj page
 * „Podpowiedzi” and the desktop header search panel.
 */
export function rememberSearchList(query: string, items: readonly { slug: string; title: string }[]): void {
  writeSessionStorage(
    listStorageKey('szukaj'),
    JSON.stringify({
      label: `Wyniki: „${query}”`,
      href: searchPath(query),
      items: items.map(({ slug, title }) => ({ slug, title })),
    }),
  )
}
