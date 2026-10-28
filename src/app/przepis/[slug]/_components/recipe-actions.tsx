import { FavoriteButton } from '@/app/components/favorite-button'
import { ShareButton } from './share-button'
import { PrintButton } from './print-button'
import { CookingMode } from './cooking-mode'

interface RecipeActionsProps {
  recipeId: number
  isFavorite: boolean
  isAuthenticated: boolean
  title: string
  /** The canonical recipe URL, shared without the ?from= list context. */
  shareUrl: string
  /** Steps and per-step photos for "Zacznij gotować" (E01-S08), the first action. */
  steps: string[]
  stepImages: string[]
}

/**
 * The recipe page's actions (handoff 2026-10-28). The first row: "Zacznij gotować" (black,
 * two parts) beside the heart button (one part, outlined); a recipe with no steps drops
 * the cooking button and the heart takes the full row. The second row: "Wydrukuj przepis"
 * and "Udostępnij przepis" as quiet text buttons. Labels stay on every button
 * (icons-always-labelled). "Zacznij gotować" (E01-S08) reads the step-photos toggle
 * through the shared useStepPhotos preference. The whole block is `print:hidden` — none of
 * it belongs on paper.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl, steps, stepImages }: RecipeActionsProps) {
  const hasSteps = steps.length > 0
  return (
    // No bottom margin: the header's own mb-8 is the gap to „Składniki” (#538).
    <div className="mt-6 flex flex-col gap-3 print:hidden">
      <div className="flex items-stretch gap-3">
        {hasSteps && (
          <div className="min-w-0 flex-[2]">
            <CookingMode title={title} steps={steps} stepImages={stepImages} />
          </div>
        )}
        <div className={hasSteps ? 'min-w-0 flex-1' : 'w-full'}>
          <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <PrintButton />
        <ShareButton title={title} url={shareUrl} />
      </div>
    </div>
  )
}
