import { FavoriteButton } from '@/app/components/favorite-button'
import { buttonClasses } from '@/app/components/ui/button'
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
  /** Steps and per-step photos for "Tryb gotowania" (E01-S08), now the 4th action. */
  steps: string[]
  stepImages: string[]
}

// 48 px below lg (the quieter secondary pair), 58 px from lg so the three line up.
const SECONDARY_BUTTON = `${buttonClasses('outline', 'md')} w-full lg:min-h-[58px] lg:text-[18px]`

/**
 * The recipe page's action row (E01-S07, E01-S31 §3), below the header on the full content
 * width (not the narrow text column) so the labelled buttons — "Dodaj do ulubionych",
 * "Udostępnij", "Drukuj" and "Tryb gotowania" — fit one line from lg. A 2→4 column grid:
 * below lg the heart (primary) takes the full first row, Udostępnij + Drukuj sit side by
 * side as a quieter smaller pair, and "Tryb gotowania" takes its own full row; from lg all
 * four are equal columns on one line (owner decision 2026-10-25, supersedes the content-
 * width note #494 — clarity for the older audience wins). A recipe with no steps drops the
 * cooking button and the grid is 3 columns. Labels stay on every button (icons-always-
 * labelled). The heart's `full` size is itself `w-full`, so it fills its cell. "Tryb
 * gotowania" (E01-S08) reads the step-photos toggle through the shared useStepPhotos
 * preference so „Ukryj” still reaches it from the far-away steps section. The whole block
 * is `print:hidden` — none of it belongs on paper.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl, steps, stepImages }: RecipeActionsProps) {
  const hasSteps = steps.length > 0
  return (
    <div
      // mb-8: the row is a standalone block between the header and the ingredients/steps,
      // so it carries its own bottom gap — otherwise it sits flush against „Składniki”
      // (the cooking button used to live in the steps section and provided that gap).
      className={`mt-6 mb-8 grid grid-cols-2 items-start gap-3 lg:gap-4 print:hidden ${hasSteps ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
    >
      {/* Heart: full row below lg, one equal column from lg. */}
      <div className="col-span-2 lg:col-span-1">
        <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      </div>
      <ShareButton title={title} url={shareUrl} className={SECONDARY_BUTTON} />
      <PrintButton className={SECONDARY_BUTTON} />
      {hasSteps && (
        <div className="col-span-2 lg:col-span-1">
          <CookingMode title={title} steps={steps} stepImages={stepImages} />
        </div>
      )}
    </div>
  )
}
