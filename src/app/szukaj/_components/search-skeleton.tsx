import { LIST_CARDS_CLASS } from '@/app/components/recipe-card'
import { LoadingStatus, RecipeGridSkeleton, SkeletonBar } from '@/app/components/recipe-card-skeleton'
import { PageContainer } from '@/app/components/page-container'
import { SEARCH_CONTENT } from './search-layout'

/**
 * The tabs, count line and cards while results load, in the place the real ones land.
 * e2e/search-skeleton.spec.ts measures this against the real page.
 */
export function SearchResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <LoadingStatus>Szukamy przepisów…</LoadingStatus>
      <div aria-hidden="true" className="flex flex-col gap-4 motion-safe:animate-pulse">
        <div data-skeleton="tabs" className="grid grid-cols-2 gap-1.5">
          <SkeletonBar className="h-[60px] rounded-tile" />
          <SkeletonBar className="h-[60px] rounded-tile" />
        </div>
        {/* The count line and the „Kategoria” button, which wraps under it on a phone. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <SkeletonBar className="h-7 w-60" />
          <SkeletonBar className="h-12 w-32 rounded-pill" />
        </div>
        <div data-skeleton="cards">
          <RecipeGridSkeleton count={6} className={LIST_CARDS_CLASS} />
        </div>
      </div>
    </div>
  )
}

/**
 * /szukaj before the browser has read the address. The saved page holds this for everyone,
 * because the query is only known in the browser.
 */
export function SearchSkeleton() {
  return (
    <PageContainer className={SEARCH_CONTENT}>
      <div aria-hidden="true" data-skeleton="field" className="lg:hidden">
        <SkeletonBar className="h-[60px] rounded-pill" />
      </div>
      <SearchResultsSkeleton />
    </PageContainer>
  )
}
