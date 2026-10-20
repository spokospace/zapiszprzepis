'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { History } from 'lucide-react'
import { searchPath } from '@/lib/routes'
import { useRecentSearches } from './use-recent-searches'

/**
 * Remembers the query this results page shows (E01-S26), whether it came from the
 * field, a chip or the home page. Signed-in users only: a guest's history would
 * show to whoever uses the device next.
 */
export function RecordRecentSearch({ q }: { q: string }) {
  const { add } = useRecentSearches()
  useEffect(() => {
    if (q) add(q)
  }, [q, add])
  return null
}

/** „Ostatnio szukane” rows on the empty search screen (4a), with „Wyczyść historię”. */
export function RecentSearchList() {
  const { recent, clear } = useRecentSearches()
  if (recent.length === 0) return null
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 id="recent-heading" className="text-[18px] font-bold text-ink-soft">
          Ostatnio szukane
        </h2>
        <button
          type="button"
          onClick={clear}
          className="min-h-12 rounded-field px-2 text-[16px] font-bold text-ink underline underline-offset-4 hover:bg-surface-3"
        >
          Wyczyść historię
        </button>
      </div>
      <ul className="divide-y divide-border-card">
        {recent.map((term) => (
          <li key={term}>
            <Link
              href={searchPath(term)}
              className="flex min-h-14 items-center gap-3 px-1 text-[19px] wrap-anywhere text-ink no-underline! hover:bg-surface-3"
            >
              <History aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-ink-soft" />
              {term}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
