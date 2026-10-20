'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { listStorageKey } from '@/lib/recipe-list-context'
import { recipePath, searchPath } from '@/lib/routes'
import { SUGGEST_MIN_LENGTH, type RecipeSuggestion } from '@/lib/search'
import { writeSessionStorage } from '@/app/components/ui/use-session-storage'
import { NoPhoto } from '@/app/components/no-photo'
import { getSuggestions } from '../actions'
import { useFieldValue } from './use-field-value'

/** Wait for a pause in typing before asking the server. */
const DEBOUNCE_MS = 250

/**
 * The suggestions for what is being typed: debounced, and only the answer to the
 * latest query is kept, so a slow reply never overwrites a newer one.
 */
function useSuggestions(query: string): RecipeSuggestion[] {
  const [result, setResult] = useState<{ q: string; items: RecipeSuggestion[] }>({ q: '', items: [] })
  const active = query.length >= SUGGEST_MIN_LENGTH
  useEffect(() => {
    if (!active) return
    let current = true
    const timer = setTimeout(() => {
      getSuggestions(query)
        .then((items) => {
          if (current) setResult({ q: query, items })
        })
        .catch(() => {
          if (current) setResult({ q: query, items: [] })
        })
    }, DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, active])
  return active && result.q === query ? result.items : []
}

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

  // A recipe opened from here leads back „← Wyniki” to this query's results (E01-S28).
  function rememberList() {
    writeSessionStorage(
      listStorageKey('szukaj'),
      JSON.stringify({
        label: `Wyniki: „${query}”`,
        href: searchPath(query),
        items: items.map(({ slug, title }) => ({ slug, title })),
      }),
    )
  }

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
                  onClick={rememberList}
                  className="flex min-h-16 items-center gap-3 py-2 text-ink no-underline! hover:bg-surface-3"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-surface-3">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={!isArchivedImageUrl(item.image_url)}
                      />
                    ) : (
                      <NoPhoto category={item.category} iconClassName="h-6 w-6" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[19px] leading-snug font-bold wrap-anywhere">{item.title}</span>
                    <span className="text-[16px] text-ink-soft">{categoryLabel(item.category)}</span>
                  </span>
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
