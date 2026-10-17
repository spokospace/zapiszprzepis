import type { Metadata } from 'next'
import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { getFullAccess } from '@/lib/full-access'
import { getFavoriteIds } from '@/lib/favorites'
import { parseSearchParams, searchRecipes, searchResultsLabel } from '@/lib/search'
import { PageContainer } from '@/app/components/page-container'
import { HomeSearch } from '@/app/components/home/home-search'
import { SearchScopeSwitch } from '@/app/components/search/search-scope'
import { SearchResults } from '@/app/components/search/search-results'
import { WebSearchFallback } from '@/app/components/search/web-search-fallback'

type SearchParams = Promise<{ q?: string | string[]; zakres?: string | string[]; strona?: string | string[] }>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = parseSearchParams(await searchParams, false)
  // Result pages are endless permutations of the same recipes: keep them out of indexes.
  return { title: q ? `„${q}” — Szukaj · ZapiszPrzepis` : 'Szukaj · ZapiszPrzepis', robots: { index: false } }
}

/**
 * The one recipe search (E01-S05), public: a guest searches everyone's recipes,
 * a signed-in user can narrow it to "Moje" or "Ulubione". Matching runs in the
 * search_recipes RPC; an empty result offers a web search.
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, raw] = await Promise.all([getCurrentUser(), searchParams])
  const { q, scope, page } = parseSearchParams(raw, Boolean(user))
  const supabase = await createSupabaseServerClient()
  const outcome = await searchRecipes(supabase, { q, scope, page })
  const rows = 'rows' in outcome ? outcome.rows : []

  const [favoriteIds, hasFullAccess] = await Promise.all([
    user && rows.length ? getFavoriteIds(supabase, user.id, rows.map((r) => r.id)) : null,
    user && q && 'rows' in outcome && rows.length === 0 ? getFullAccess(supabase) : false,
  ])

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
            <p role="status" className="text-[19px] text-ink">
              {searchResultsLabel(outcome.total, q)}
            </p>
            {rows.length > 0 ? (
              <SearchResults
                q={q}
                scope={scope}
                page={page}
                rows={rows}
                total={outcome.total}
                favoriteIds={user ? (favoriteIds ?? new Set()) : null}
              />
            ) : (
              <WebSearchFallback q={q} hasFullAccess={hasFullAccess} />
            )}
          </>
        )}
      </PageContainer>
    </main>
  )
}
