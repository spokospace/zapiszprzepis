import { PageContainer } from '@/app/components/page-container'
import { LoadingStatus, SkeletonBar } from '@/app/components/recipe-card-skeleton'

/**
 * A recipe while its page renders (#227): the cover, title, meta lines and the
 * ingredients/steps columns, without data. The shape mirrors page.tsx so the real
 * content lands where the placeholders were, with no reflow: the same full-width
 * container, the lg header grid (photo | text, 1.2fr 1fr) and the lg checklists
 * grid (ingredients panel | steps, 1fr 1.6fr).
 */
export default function RecipeLoading() {
  return (
    <main className="min-h-screen bg-white py-6 sm:py-8">
      <PageContainer>
        <LoadingStatus>Ładowanie przepisu…</LoadingStatus>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          {/* RecipeHeader: photo | text column from lg; single column below. */}
          <header className="mb-8 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-10">
            <div className="mb-5 aspect-[4/3] w-full rounded-tile bg-gray-100 lg:mb-0 lg:aspect-[16/10]" />
            <div>
              {/* 32 px title, 44 px from lg. */}
              <SkeletonBar className="mb-3 h-9 w-3/4 lg:h-12" />
              {/* Description / subtitle. */}
              <SkeletonBar className="mb-3 h-5 w-1/2" />
              {/* Category · time line (below lg) / times row (from lg). */}
              <SkeletonBar className="mb-3 h-5 w-2/3" />
              {/* "Dodała/Dodał …" author line. */}
              <SkeletonBar className="h-4 w-40" />
            </div>
          </header>

          {/* RecipeActions: two big cards, then the print / share pair (2 × 2 from lg). */}
          <div className="mt-6 mb-8 grid grid-cols-2 gap-3 lg:gap-4">
            <SkeletonBar className="col-span-2 h-[76px] rounded-xl lg:col-span-1" />
            <SkeletonBar className="col-span-2 h-[76px] rounded-xl lg:col-span-1" />
            <SkeletonBar className="h-16 rounded-xl" />
            <SkeletonBar className="h-16 rounded-xl" />
          </div>

          {/* RecipeChecklists: ingredients panel | steps from lg; single column below. */}
          <div className="lg:grid lg:grid-cols-[1fr_1.6fr] lg:items-start lg:gap-x-12">

            {/* Składniki — a bordered panel from lg. */}
            <div className="mb-10 lg:rounded-tile lg:border lg:border-border-card lg:bg-surface-2 lg:p-6">
              <SkeletonBar className="mb-4 h-8 w-40" />
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkeletonBar key={i} className={`h-4 ${i % 2 ? 'w-2/3' : 'w-5/6'}`} />
                ))}
              </div>
            </div>

            {/* Przygotowanie. */}
            <div>
              <SkeletonBar className="mb-4 h-8 w-48" />
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <SkeletonBar key={i} className={`h-4 ${i % 2 ? 'w-3/4' : 'w-full'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
