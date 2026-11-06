'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { recipesNoun } from '@/app/components/app-menu-model'
import { CategoryGrid } from '@/app/components/home/category-grid'
import { HomeSearch } from '@/app/components/home/home-search'
import { PageContainer } from '@/app/components/page-container'
import { SearchCategoryFilter, type CategoryOption } from '@/app/components/search/search-category-filter'
import { SearchResults } from '@/app/components/search/search-results'
import { SearchScopeSwitch } from '@/app/components/search/search-scope'
import { SearchTabs } from '@/app/components/search/search-tabs'
import { buttonClasses } from '@/app/components/ui/button'
import { useBrowserSession } from '@/lib/browser-session'
import { searchPath } from '@/lib/routes'
import { parseSearchParams } from '@/lib/search'
import { QuickSearchBar } from './quick-search-bar'
import { RecentSearchList, RecordRecentSearch } from './recent-searches'
import { SEARCH_CONTENT } from './search-layout'
import { SearchResultsSkeleton } from './search-skeleton'
import { SearchSuggestions } from './search-suggestions'
import { useSearch } from './use-search'

/**
 * The one recipe search (E01-S05), public: a guest searches everyone's recipes, a signed-in
 * user can narrow it to "Moje" or "Ulubione". Everything runs in the browser, so one saved page
 * serves every query and the Worker renders nothing. The results can be narrowed to one category
 * (E01-S22, C2) and sit in the „W serwisie” tab beside an on-demand „Na blogach” search
 * (E01-S30). Below lg it is a full screen of its own (handoff v8 screen 4, E01-S26): recent
 * searches and categories before a query, and quick-search chips above the keyboard.
 */
export function SearchScreen() {
  const address = Object.fromEntries(useSearchParams())
  const session = useBrowserSession()
  const user = session.status === 'user'
  const params = parseSearchParams(address, user)
  const { q, scope, page, category } = params
  // „Moje” in the address means nothing until the session says who is reading.
  const ready = session.status !== 'unknown' || parseSearchParams(address, true).scope === 'wszystkie'
  const { results, failed, retry } = useSearch(params, ready)
  const rows = results?.rows ?? []
  const hasResults = Boolean(q && results)

  // Again once results are in: the page's own <title> arrives after this first runs.
  useEffect(() => {
    document.title = q ? `„${q}” — Szukaj · Zapisz Przepis` : 'Szukaj · Zapisz Przepis'
  }, [q, hasResults])

  // „Pokaż kolejne” links to the first new card, which does not exist until the rows arrive.
  useEffect(() => {
    if (hasResults && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [hasResults, rows.length])

  // "Kategoria" only when there is something to narrow, or a filter to undo.
  const categoryOptions: CategoryOption[] =
    results && (results.categories.length > 1 || category)
      ? [
          { value: null, label: 'Wszystkie', count: results.totalAll, href: searchPath(q, scope) },
          ...results.categories.map((c) => ({ ...c, href: searchPath(q, scope, 1, c.value) })),
        ]
      : []

  return (
    <>
      {user && <RecordRecentSearch q={q} />}
      <PageContainer className={SEARCH_CONTENT}>
        {/* From lg the app header carries the one search field (E01-S17 follow-up), so the
            page drops its own; below lg this is the full-screen search's field. key: a new
            query (or "Wyczyść") remounts the field with the new value. */}
        <div className="flex flex-col gap-4 lg:hidden">
          <HomeSearch key={q} id="search-page-field" defaultValue={q} scope={scope} autoFocus={!q} compact />
          <SearchSuggestions key={`s-${q}`} fieldId="search-page-field" initialValue={q} />
        </div>
        {/* With results, „Szukaj w:” moves into the „W serwisie” tab (E01-S30). */}
        {user && !hasResults && <SearchScopeSwitch q={q} scope={scope} />}
        {!q ? (
          <>
            <p className="text-[19px] text-ink-soft">Wpisz nazwę dania albo składnik, np. „pierogi” albo „cukinia”.</p>
            {user && <RecentSearchList />}
            <div className="lg:hidden">
              <CategoryGrid columns={2} title="Albo wybierz kategorię" />
            </div>
          </>
        ) : failed ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-[19px] text-danger">Wyszukiwanie chwilowo nie działa.</p>
            <button type="button" onClick={retry} className={buttonClasses('outline', 'lg')}>
              Spróbuj ponownie
            </button>
          </div>
        ) : !results ? (
          <SearchResultsSkeleton />
        ) : (
          <SearchTabs
            key={q}
            q={q}
            localCount={`${results.total} ${recipesNoun(results.total)}`}
            hasLocalResults={rows.length > 0}
            isAuthenticated={user}
            hasFullAccess={session.status === 'user' && session.menu?.hasFullAccess === true}
          >
            {user && <SearchScopeSwitch q={q} scope={scope} />}
            {/* Kept with no matches while a category filter is on, so it can be undone. */}
            {(rows.length > 0 || category) && (
              <SearchCategoryFilter options={categoryOptions} selected={category}>
                <p role="status" className="text-[19px] text-ink">
                  <strong>
                    {results.total} {recipesNoun(results.total)}
                  </strong>{' '}
                  dla „{q}”
                </p>
              </SearchCategoryFilter>
            )}
            {rows.length > 0 ? (
              <SearchResults q={q} scope={scope} page={page} category={category} rows={rows} total={results.total} />
            ) : (
              <div>
                <h2 id="no-results-heading" className="text-[22px] font-bold break-words text-ink">
                  Nie mamy jeszcze przepisu „{q}”
                </h2>
                <p className="mt-1 text-[17px] text-ink-soft">Sprawdź pisownię albo wpisz jeden składnik, np. „dynia”.</p>
              </div>
            )}
          </SearchTabs>
        )}
      </PageContainer>
      <QuickSearchBar key={q} fieldId="search-page-field" initialValue={q} isAuthenticated={user} />
    </>
  )
}
