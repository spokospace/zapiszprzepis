import Link from 'next/link'
import { POPULAR_SEARCHES } from '@/lib/home'
import { searchPath } from '@/lib/routes'

/**
 * "Często szukane:" (guest home, E01-S04): a row of pill links that run a
 * search, inside the hero under the search button (A1/A8).
 */
export function PopularSearches() {
  return (
    <nav
      aria-labelledby="popular-heading"
      className="mt-4 flex flex-wrap items-center gap-2 lg:mx-auto lg:max-w-[760px] lg:justify-center"
    >
      {/* The label stays outside the list, so the list holds only the searches. */}
      <span id="popular-heading" className="text-[17px] text-ink-soft">
        Często szukane:
      </span>
      <ul className="flex flex-wrap gap-2">
        {POPULAR_SEARCHES.map((term) => (
          <li key={term}>
            <Link
              href={searchPath(term)}
              className="inline-flex min-h-[48px] items-center rounded-pill border-2 border-border-chip bg-white px-4 text-[17px] font-bold wrap-anywhere text-action-text no-underline! hover:bg-surface-accent-2"
            >
              {term}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
