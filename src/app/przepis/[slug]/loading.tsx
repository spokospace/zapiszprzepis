import { PageContainer } from '@/app/components/page-container'
import { LoadingStatus, SkeletonBar } from '@/app/components/recipe-card-skeleton'

/**
 * A recipe while its page renders (#227): the cover, title, chips, the favorite button
 * and the two columns of the recipe page, without data.
 */
export default function RecipeLoading() {
  return (
    <div className="min-h-screen bg-white py-8">
      <PageContainer narrow>
        <LoadingStatus>Ładowanie przepisu…</LoadingStatus>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          <div className="mb-8 aspect-[4/3] w-full rounded-lg bg-gray-100 sm:aspect-video" />
          <div className="mb-8">
            <SkeletonBar className="mb-4 h-10 w-3/4" />
            <SkeletonBar className="mb-5 h-5 w-1/2" />
            <div className="flex flex-wrap gap-3">
              <SkeletonBar className="h-7 w-24 rounded-full" />
              <SkeletonBar className="h-7 w-32 rounded-full" />
              <SkeletonBar className="h-7 w-36 rounded-full" />
            </div>
            <SkeletonBar className="mt-4 h-[58px] w-full rounded-field sm:w-72" />
          </div>
          <div className="mb-12 grid gap-8 md:grid-cols-2">
            {[6, 4].map((lines, column) => (
              <div key={column}>
                <SkeletonBar className="mb-4 h-8 w-40" />
                <div className="space-y-3">
                  {Array.from({ length: lines }, (_, i) => (
                    <SkeletonBar key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-5/6'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
