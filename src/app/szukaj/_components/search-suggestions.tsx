'use client'

import Link from 'next/link'
import { recipePath, searchPath } from '@/lib/routes'
import { rememberSearchList } from '@/app/components/search/remember-search-list'
import { SuggestionRowContent } from '@/app/components/search/suggestion-row'
import { useSuggestions } from '@/app/components/search/use-suggestions'
import { useFieldValue } from './use-field-value'

/**
 * „Podpowiedzi” under the /szukaj field (handoff v8 screen 4, E01-S29): from two
 * letters, up to four recipes; a tap opens the recipe, „Pokaż wszystkie wyniki”
 * runs the search. Shown only once the visitor types — not for the query a results
 * page already shows.
 */
export function SearchSuggestions({ fieldId, initialValue }: { fieldId: string; initialValue: string }) {
  const value = useFieldValue(fieldId, initialValue)
  const query = value.trim()
  const typed = value !== initialValue
  const items = useSuggestions(typed ? query : '')
  const show = typed && items.length > 0

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {show ? `${items.length} ${items.length === 1 ? 'podpowiedź' : 'podpowiedzi'}` : ''}
      </p>
      {show && (
        <section aria-labelledby="suggestions-heading">
          <h2 id="suggestions-heading" className="mb-1 text-[18px] font-bold text-ink-soft">
            Podpowiedzi
          </h2>
          <ul className="divide-y divide-border-card">
            {items.map((item) => (
              <li key={item.slug}>
                <Link
                  href={recipePath(item.slug, { from: 'szukaj' })}
                  // A recipe opened from here leads back „← Wyniki” to this query's results (E01-S28).
                  onClick={() => rememberSearchList(query, items)}
                  className="flex min-h-16 items-center gap-3 py-2 text-ink no-underline! hover:bg-surface-3"
                >
                  <SuggestionRowContent title={item.title} category={item.category} imageUrl={item.image_url} />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={searchPath(query)}
            className="mt-2 inline-flex min-h-12 items-center text-[18px] font-bold wrap-anywhere text-action-text underline underline-offset-4 hover:text-action-hover"
          >
            Pokaż wszystkie wyniki dla „{query}”
          </Link>
        </section>
      )}
    </>
  )
}
