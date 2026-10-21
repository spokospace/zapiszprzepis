import Link from 'next/link'
import { POPULAR_SEARCHES } from '@/lib/home'
import { searchPath } from '@/lib/routes'

/** How many terms the hero shows on desktop; a phone shows one fewer (handoff 14). */
const HERO_TERMS = 5

/**
 * "Często szukane" inside the home hero (handoff 14, guest and signed in): under a 1 px
 * rule, a lead-in line and pill links that run a search. The list itself is shared with
 * the header search panel and /szukaj, so the hero only slices it. Plain links, so it
 * works without JS.
 */
export function PopularSearches() {
  return (
    <section aria-label="Często szukane" className="mt-6 flex flex-col gap-3 border-t border-border-card-2 pt-4 md:mt-8 md:items-center md:pt-5 md:text-center">
      <p className="text-[18px] font-bold text-ink">
        <span className="md:hidden">Nie wiesz, co wpisać? Kliknij:</span>
        <span className="max-md:hidden">Nie wiesz, co wpisać? Kliknij jedno z najczęściej szukanych:</span>
      </p>
      <ul className="flex flex-wrap gap-2 md:justify-center">
        {POPULAR_SEARCHES.slice(0, HERO_TERMS).map((term, i) => (
          <li key={term} className={i === HERO_TERMS - 1 ? 'max-sm:hidden' : undefined}>
            <Link
              href={searchPath(term)}
              className="inline-flex h-[52px] items-center rounded-pill border-2 border-border-dark bg-white px-5 text-[18px] font-bold wrap-anywhere text-ink no-underline! hover:bg-surface-3"
            >
              {term}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
