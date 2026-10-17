import { Search } from 'lucide-react'
import { SEARCH_PATH } from '@/lib/routes'

/**
 * The signed-in desktop header's search (E01-S17, A9): a plain GET form to
 * SEARCH_PATH, so it works without JS. No mic — the page-level HomeSearch
 * keeps it. Its landmark name differs from the page forms' labels so two
 * search landmarks on one page stay distinguishable.
 */
export function HeaderSearch({ className = '' }: { className?: string }) {
  return (
    <form
      role="search"
      aria-label="Szukaj w serwisie"
      method="get"
      action={SEARCH_PATH}
      className={`min-w-0 max-w-[460px] flex-1 gap-2 ${className}`}
    >
      <label htmlFor="header-search" className="sr-only">
        Szukaj przepisu lub składnika
      </label>
      <input
        id="header-search"
        type="search"
        name="q"
        required
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Szukaj przepisu lub składnika"
        className="h-12 min-w-0 flex-1 rounded-field border-2 border-field bg-white px-3 text-[17px] text-ink placeholder:text-ink-muted"
      />
      <button
        type="submit"
        className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-field border-2 border-field bg-white px-3 text-[17px] font-bold text-ink hover:bg-surface-3"
      >
        <Search aria-hidden="true" className="h-5 w-5" />
        Szukaj
      </button>
    </form>
  )
}
