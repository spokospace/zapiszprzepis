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
 * The recipe page's action cards (E01-S07, E01-S31 §3; design 2026-10-28), the
 * header's last item (see RecipeHeader for where it sits per width). Two big cards — "Tryb gotowania" (dark) and
 * "Dodaj do ulubionych", each with a hint line — then "Wydrukuj przepis" and
 * "Udostępnij przepis" as a lower pair. Below lg the big cards take a row each and the
 * pair sits side by side; between lg and xl all four share one full-width row; from xl
 * they are a 2 × 2 grid under the description. A recipe with no steps drops the cooking
 * card and the heart takes the cooking card's place (a whole row below lg and from xl). Labels stay on every button
 * (icons-always-labelled). "Tryb gotowania" (E01-S08) reads the step-photos toggle
 * through the shared useStepPhotos preference so „Ukryj” still reaches it from the
 * far-away steps section. The whole block is `print:hidden` — none of it belongs on paper.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl, steps, stepImages }: RecipeActionsProps) {
  const hasSteps = steps.length > 0
  return (
    // No bottom margin: the header's own mb-8 is the gap to „Składniki” (#538).
    <div
      className={`mt-6 grid grid-cols-2 items-start gap-3 lg:gap-4 xl:grid-cols-2 print:hidden ${hasSteps ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
    >
      {hasSteps && (
        <div className="col-span-2 lg:col-span-1">
          <CookingMode title={title} steps={steps} stepImages={stepImages} />
        </div>
      )}
      <div className={hasSteps ? 'col-span-2 lg:col-span-1' : 'col-span-2 lg:col-span-1 xl:col-span-2'}>
        <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      </div>
      <PrintButton />
      <ShareButton title={title} url={shareUrl} />
    </div>
  )
}
