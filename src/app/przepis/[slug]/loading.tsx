import type { ReactNode } from 'react'
import { PageContainer } from '@/app/components/page-container'
import { LoadingStatus, SkeletonBar } from '@/app/components/recipe-card-skeleton'
import {
  RECIPE_CHECKLISTS_TOP,
  RECIPE_COVER_FRAME,
  RECIPE_HEADER_GRID,
  RECIPE_MAIN,
  RECIPE_SPLIT,
  RECIPE_TOP_ROW,
} from './_components/recipe-split'

/**
 * A recipe while its page renders (#227): the cover, title, meta lines, the action
 * buttons and the ingredients/steps columns, without data. It is built from the same
 * layout strings as page.tsx (recipe-split.ts: the <main> padding, the row above the
 * hero, the header grid, the cover frame, the checklists' top rule and the split), so
 * the columns, gaps and offsets cannot drift from the page (#637). The text column
 * follows the real blocks in order with the heights they have from lg, because the
 * header is as tall as that column: a title, the subtitle, the author line, a
 * three-line description, the four-item time strip and the buttons. The "other
 * versions" box is not drawn, because most recipes have none.
 * e2e/recipe-skeleton.spec.ts measures this against the real page.
 */

/** One text line of a given line-box height, with the bar centred in it. */
function Line({ box, children }: { box: string; children: ReactNode }) {
  return <div className={`flex items-center ${box}`}>{children}</div>
}

/** Heading of a checklist block: the 24 px heading's 36 px line plus its 12 px margin. */
function HeadingBar({ className }: { className: string }) {
  return (
    <Line box="mb-3 h-9">
      <SkeletonBar className={className} />
    </Line>
  )
}

export default function RecipeLoading() {
  return (
    <main className={RECIPE_MAIN}>
      <PageContainer>
        <LoadingStatus>Ładowanie przepisu…</LoadingStatus>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          {/* The row above the hero, from lg: list position left, breadcrumbs right. */}
          <div className={RECIPE_TOP_ROW}>
            <SkeletonBar className="hidden h-5 w-40 lg:block" />
            <SkeletonBar className="ml-auto hidden h-5 w-64 lg:block" />
          </div>

          <header className={RECIPE_HEADER_GRID}>
            {/* The photo: 4:3, bleeding to the edges below lg like the real cover. */}
            <div className={RECIPE_COVER_FRAME}>
              <div className="aspect-[4/3] w-full bg-gray-100" />
            </div>

            <div>
              {/* Title: 32 px, 48 px from lg (a 50 px line). */}
              <Line box="mb-2 lg:h-[50px]">
                <SkeletonBar className="h-9 w-3/4 lg:h-10" />
              </Line>
              {/* Subtitle. */}
              <Line box="mb-3 lg:h-[29px]">
                <SkeletonBar className="h-5 w-1/2" />
              </Line>
              {/* "Dodane przez …": the initial's circle and the line. */}
              <div className="mt-4 flex h-8 items-center gap-2">
                <SkeletonBar className="h-8 w-8 shrink-0 rounded-pill" />
                <SkeletonBar className="h-4 w-40" />
              </div>
              {/* Description: three lines of 31 px. */}
              <div className="mt-4">
                {[0, 1, 2].map((i) => (
                  <Line key={i} box="h-[31px]">
                    <SkeletonBar className={`h-4 ${i === 2 ? 'w-3/5' : 'w-full'}`} />
                  </Line>
                ))}
              </div>
              {/* The time strip: the same auto-fit grid, 54 px items. */}
              <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(165px,1fr))] gap-x-5 gap-y-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex h-[54px] items-center gap-3">
                    <SkeletonBar className="h-11 w-11 shrink-0 rounded-pill" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <SkeletonBar className="h-4 w-20" />
                      <SkeletonBar className="h-5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
              {/* The actions: "Zacznij gotować" and "Zapisz", then print / share. */}
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex flex-col gap-3 min-[480px]:flex-row">
                  <SkeletonBar className="h-[60px] min-w-0 flex-[2] rounded-pill" />
                  <SkeletonBar className="h-[60px] min-w-0 flex-1 rounded-pill" />
                </div>
                <div className="flex h-12 items-center gap-6 px-3">
                  <SkeletonBar className="h-5 w-20" />
                  <SkeletonBar className="h-5 w-28" />
                </div>
              </div>
            </div>
          </header>

          {/* The checklists: ingredients panel | steps, under the hairline and 40 px. */}
          <div className={`${RECIPE_CHECKLISTS_TOP} ${RECIPE_SPLIT}`}>
            <div className="mb-10 lg:rounded-tile lg:border lg:border-border-card lg:bg-surface-2 lg:p-6">
              <HeadingBar className="h-8 w-40" />
              {/* Ingredient rows are 56 px. */}
              {Array.from({ length: 6 }, (_, i) => (
                <Line key={i} box="h-14">
                  <SkeletonBar className={`h-4 ${i % 2 ? 'w-2/3' : 'w-5/6'}`} />
                </Line>
              ))}
            </div>

            <div>
              <HeadingBar className="h-8 w-48" />
              {/* Steps: a number and two lines each. */}
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="mb-6 flex h-[88px] items-start gap-4">
                  <SkeletonBar className="h-10 w-10 shrink-0 rounded-pill" />
                  <div className="min-w-0 flex-1 space-y-3 pt-2">
                    <SkeletonBar className="h-4 w-full" />
                    <SkeletonBar className={`h-4 ${i % 2 ? 'w-3/4' : 'w-5/6'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
