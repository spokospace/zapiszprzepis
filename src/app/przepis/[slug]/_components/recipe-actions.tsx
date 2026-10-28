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
  /** Steps and per-step photos for "Tryb gotowania" (E01-S08), the first action. */
  steps: string[]
  stepImages: string[]
}

/**
 * The recipe page's action row (E01-S07, E01-S31 §3; design 2026-10-28), below the
 * header on the full content width. Two big cards — "Włącz tryb gotowania" (dark) and
 * "Dodaj do ulubionych", each with a hint line — then "Wydrukuj przepis" and
 * "Udostępnij przepis" as a lower pair. Below lg the big cards take a row each and the
 * pair sits side by side; from lg it is a 2 × 2 grid. A recipe with no steps drops the
 * cooking card and the heart takes the whole first row. Labels stay on every button
 * (icons-always-labelled). "Tryb gotowania" (E01-S08) reads the step-photos toggle
 * through the shared useStepPhotos preference so „Ukryj” still reaches it from the
 * far-away steps section. The whole block is `print:hidden` — none of it belongs on paper.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl, steps, stepImages }: RecipeActionsProps) {
  const hasSteps = steps.length > 0
  return (
    <div
      // mb-8: the row is a standalone block between the header and the ingredients/steps,
      // so it carries its own bottom gap — otherwise it sits flush against „Składniki” (#538).
      className="mt-6 mb-8 grid grid-cols-2 items-start gap-3 lg:gap-4 print:hidden"
    >
      {hasSteps && (
        <div className="col-span-2 lg:col-span-1">
          <CookingMode title={title} steps={steps} stepImages={stepImages} />
        </div>
      )}
      <div className={hasSteps ? 'col-span-2 lg:col-span-1' : 'col-span-2'}>
        <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      </div>
      <PrintButton />
      <ShareButton title={title} url={shareUrl} />
    </div>
  )
}
