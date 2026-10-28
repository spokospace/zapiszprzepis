import { PageContainer } from '@/app/components/page-container'
import { LoadingStatus, SkeletonBar } from '@/app/components/recipe-card-skeleton'
import { RECIPE_SPLIT } from './_components/recipe-split'

/**
 * A recipe while its page renders (#227): the cover, title, meta lines, the action
 * cards and the ingredients/steps columns, without data. The shape mirrors page.tsx so
 * the real content lands where the placeholders were, with no reflow: the same
 * full-width container and, from lg, the same 1fr | 1.6fr split for the header (photo |
 * text with the action cards) and the checklists (ingredients panel | steps).
 */
export default function RecipeLoading() {
  return (
    <main className="min-h-screen bg-white py-6 sm:py-8">
      <PageContainer>
        <LoadingStatus>Ładowanie przepisu…</LoadingStatus>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          {/* RecipeHeader: photo | text column from lg; single column below. */}
          <header className={`mb-8 ${RECIPE_SPLIT} xl:grid-rows-[auto_1fr]`}>
            <div className="mb-5 aspect-[4/3] w-full rounded-tile bg-gray-100 lg:mb-0 xl:row-span-2" />
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
            {/* RecipeActions: two big cards, then the print / share pair; one full-width
                row of four between lg and xl, 2 × 2 under the text from xl. */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4 lg:gap-4 xl:col-span-1 xl:col-start-2 xl:grid-cols-2">
              <SkeletonBar className="col-span-2 h-[76px] rounded-xl lg:col-span-1" />
              <SkeletonBar className="col-span-2 h-[76px] rounded-xl lg:col-span-1" />
              <SkeletonBar className="h-16 rounded-xl lg:max-xl:h-[76px]" />
              <SkeletonBar className="h-16 rounded-xl lg:max-xl:h-[76px]" />
            </div>
          </header>

          {/* RecipeChecklists: ingredients panel | steps from lg; single column below. */}
          <div className={RECIPE_SPLIT}>

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
