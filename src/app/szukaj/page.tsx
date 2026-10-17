import type { Metadata } from 'next'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFullAccess } from '@/lib/full-access'
import { getFavoriteIds } from '@/lib/favorites'
import { searchPath } from '@/lib/routes'
import { parseSearchParams, searchRecipes } from '@/lib/search'
import { recipesNoun } from '@/app/components/app-menu-model'
import { PageContainer } from '@/app/components/page-container'
import { HomeSearch } from '@/app/components/home/home-search'
import { SearchScopeSwitch } from '@/app/components/search/search-scope'
import { SearchResults } from '@/app/components/search/search-results'
import { SearchCategoryFilter, type CategoryOption } from '@/app/components/search/search-category-filter'
import { WebSearchFallback } from '@/app/components/search/web-search-fallback'

type SearchParams = Promise<{
  q?: string | string[]
  zakres?: string | string[]
  strona?: string | string[]
  kategoria?: string | string[]
}>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = parseSearchParams(await searchParams, false)
  // Result pages are endless permutations of the same recipes: keep them out of indexes.
  return { title: q ? `„${q}” — Szukaj · ZapiszPrzepis` : 'Szukaj · ZapiszPrzepis', robots: { index: false } }
}

/**
 * The one recipe search (E01-S05), public: a guest searches everyone's recipes,
 * a signed-in user can narrow it to "Moje" or "Ulubione". Matching runs in the
 * search_recipes RPC. The results can be narrowed to one category, and every
 * list ends with a web search (E01-S22, C2/A3).
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, raw] = await Promise.all([getCurrentUser(), searchParams])
  const { q, scope, page, category } = parseSearchParams(raw, Boolean(user))
  const supabase = await createSupabaseServerClient()
  const outcome = await searchRecipes(supabase, { q, scope, page, category })
  const rows = 'rows' in outcome ? outcome.rows : []

  const [favoriteIds, hasFullAccess] = await Promise.all([
    user && rows.length ? getFavoriteIds(supabase, user.id, rows.map((r) => r.id)) : null,
    user && q && 'rows' in outcome ? getFullAccess(supabase) : false,
  ])

  // "Kategoria" only when there is something to narrow, or a filter to undo.
  const categoryOptions: CategoryOption[] =
    'rows' in outcome && (outcome.categories.length > 1 || category)
      ? [
          { value: null, label: 'Wszystkie', count: outcome.totalAll, href: searchPath(q, scope) },
          ...outcome.categories.map((c) => ({ ...c, href: searchPath(q, scope, 1, c.value) })),
        ]
      : []

  return (
    <main className="min-h-screen bg-white">
      <PageContainer className="flex flex-col gap-4 py-6">
        <h1 className="text-[28px] leading-tight font-bold text-ink">Szukaj przepisu</h1>
        {/* key: a new query (or "Wyczyść") remounts the field with the new value. */}
        <HomeSearch key={q} id="search-page-field" defaultValue={q} scope={scope} autoFocus={!q} />
        {user && <SearchScopeSwitch q={q} scope={scope} />}
        {!q ? (
          <p className="text-[19px] text-ink-soft">
            Wpisz nazwę dania albo składnik, np. „pierogi” albo „cukinia”.
          </p>
        ) : 'error' in outcome ? (
          <p role="alert" className="text-[19px] text-danger">
            Wyszukiwanie chwilowo nie działa. Spróbuj za chwilę.
          </p>
        ) : (
          <>
            <SearchCategoryFilter options={categoryOptions} selected={category}>
              <p role="status" className="text-[19px] text-ink">
                <strong>
                  {outcome.total} {recipesNoun(outcome.total)}
                </strong>{' '}
                dla „{q}”
              </p>
            </SearchCategoryFilter>
            {rows.length > 0 && (
              <SearchResults
                q={q}
                scope={scope}
                page={page}
                category={category}
                rows={rows}
                total={outcome.total}
                favoriteIds={user ? (favoriteIds ?? new Set()) : null}
              />
            )}
            <WebSearchFallback q={q} hasFullAccess={hasFullAccess} hasResults={rows.length > 0} />
          </>
        )}
      </PageContainer>
    </main>
  )
}
