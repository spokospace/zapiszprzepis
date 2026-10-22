import Link from 'next/link'
import { searchPath, SEARCH_SCOPES, type SearchScope } from '@/lib/routes'

const LABELS: Record<SearchScope, string> = {
  wszystkie: 'Wszystkich',
  moje: 'Moich',
  ulubione: 'Ulubionych',
}

/**
 * "Szukaj w: Wszystkich / Moich / Ulubionych" (E01-S05) — signed-in users only.
 * Plain links, so a switch is a new search from page 1 that works without JS.
 */
export function SearchScopeSwitch({ q, scope }: { q: string; scope: SearchScope }) {
  return (
    <nav aria-labelledby="search-scope-label">
      <p id="search-scope-label" className="mb-1.5 text-[16px] font-bold text-ink">
        Szukaj w:
      </p>
      {/* Equal thirds while every word fits; at a large font a pill never goes below its word
          ("Wszystkich"), so the row wraps instead of cutting it mid-word (#478). */}
      <ul className="flex flex-wrap gap-1.5">
        {SEARCH_SCOPES.map((value) => {
          const active = value === scope
          return (
            <li key={value} className="min-w-fit flex-1 basis-0">
              <Link
                href={searchPath(q, value)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full min-h-[52px] min-w-0 items-center justify-center rounded-pill border-2 px-1 text-center text-[16px] leading-tight wrap-label no-underline! min-[360px]:text-[18px] font-bold ${
                  active
                    ? 'border-surface-dark bg-surface-dark text-white'
                    : 'border-field bg-white text-ink hover:bg-surface-3'
                }`}
              >
                {LABELS[value]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
