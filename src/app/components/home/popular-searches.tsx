import Link from 'next/link'
import { POPULAR_SEARCHES } from '@/lib/home'
import { searchPath } from '@/lib/routes'

/** "Często szukane" (guest home, E01-S04): pill links that run a search. */
export function PopularSearches() {
  return (
    <section aria-labelledby="popular-heading">
      <h2 id="popular-heading" className="mb-3 text-[22px] font-bold text-ink">
        Często szukane
      </h2>
      <ul className="flex flex-wrap gap-2">
        {POPULAR_SEARCHES.map((term) => (
          <li key={term}>
            <Link
              href={searchPath(term)}
              className="inline-flex min-h-[48px] items-center rounded-pill border-2 border-border-card-2 bg-white px-4 text-[17px] font-bold text-ink hover:bg-surface-3"
            >
              {term}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
