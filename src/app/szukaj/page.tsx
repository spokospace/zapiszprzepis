import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchScreen } from './_components/search-screen'
import { SearchScreenBar } from './_components/search-screen-bar'
import { SearchSkeleton } from './_components/search-skeleton'

// Result pages are endless permutations of the same recipes: keep them out of indexes.
export const metadata: Metadata = { title: 'Szukaj · Zapisz Przepis', robots: { index: false } }

/**
 * Static: it reads no session and no address on the server, so the build can save it as a
 * file (scripts/export-recipe-files.mjs). The search itself is SearchScreen, in the browser.
 */
export default function SearchPage() {
  return (
    <main className="min-h-screen bg-white pb-36 lg:pb-0">
      <SearchScreenBar />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchScreen />
      </Suspense>
    </main>
  )
}
