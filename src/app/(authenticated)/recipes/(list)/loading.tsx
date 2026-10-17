import { PageContainer } from '@/app/components/page-container'
import { LoadingStatus, RecipeGridSkeleton, SkeletonBar } from '@/app/components/recipe-card-skeleton'

// Chip widths vary like the category labels do, so the row does not look like a barcode.
const CHIP_WIDTHS = ['w-24', 'w-20', 'w-28', 'w-24', 'w-32', 'w-20', 'w-28', 'w-24']

/**
 * "Moje przepisy" while the list renders (#227): RecipesContent's container, heading,
 * search field, category chips and grid, without data.
 *
 * It sits in the (list) route group so it wraps /recipes only. Placed in recipes/, it
 * would also wrap recipes/[slug]: a recipe opened from the home page would show this
 * list skeleton, since a navigation shows the first loading boundary below the layouts
 * it shares with the current page.
 */
export default function RecipesLoading() {
  return (
    <div className="min-h-screen bg-white py-8">
      <PageContainer>
        <LoadingStatus>Ładowanie przepisów…</LoadingStatus>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-900">Moje przepisy</div>
            <SkeletonBar className="mt-3 h-5 w-28" />
          </div>
          <SkeletonBar className="mb-4 h-[42px] w-full rounded-lg" />
          <div className="mb-8 flex flex-wrap gap-2">
            {CHIP_WIDTHS.map((width, i) => (
              <SkeletonBar key={i} className={`h-9 rounded-full ${width}`} />
            ))}
          </div>
          <RecipeGridSkeleton count={6} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" />
        </div>
      </PageContainer>
    </div>
  )
}
