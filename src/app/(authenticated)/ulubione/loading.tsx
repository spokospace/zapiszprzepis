import { PageContainer } from '@/app/components/page-container'
import { LoadingStatus, RecipeGridSkeleton } from '@/app/components/recipe-card-skeleton'

/** "Ulubione" while the list renders (#227): the page's heading and grid, without data. */
export default function FavoritesLoading() {
  return (
    <main className="min-h-screen bg-white">
      <PageContainer className="py-6 sm:py-12">
        <LoadingStatus>Ładowanie ulubionych…</LoadingStatus>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          <div className="mb-6 text-2xl font-bold text-ink">Ulubione</div>
          <RecipeGridSkeleton count={6} className="grid grid-cols-1 gap-3 sm:grid-cols-3" />
        </div>
      </PageContainer>
    </main>
  )
}
