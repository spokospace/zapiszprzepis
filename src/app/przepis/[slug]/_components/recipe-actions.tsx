import { FavoriteButton } from '@/app/components/favorite-button'
import { buttonClasses } from '@/app/components/ui/button'
import { ShareButton } from './share-button'

interface RecipeActionsProps {
  recipeId: number
  isFavorite: boolean
  isAuthenticated: boolean
  title: string
  /** The canonical recipe URL, shared without the ?from= list context. */
  shareUrl: string
}

// 48 px below lg; from lg 58 px like the heart beside it (lg: so it outranks the size's own min-height).
const SECONDARY_BUTTON = `${buttonClasses('outline', 'md')} lg:min-h-[58px] lg:text-[18px]`

/**
 * The recipe page's action row (E01-S07, E01-S31 §3), last in the header's text
 * column: "Dodaj do ulubionych" and "Udostępnij". Stacked below sm, side by side
 * from sm. The original is reached from the source badge on the photo now, so there
 * is no "Oryginał" button here or at the end of the recipe. The heart's behaviour
 * belongs to E01-S06 (FavoriteButton is passed through unchanged). E01-S08's "Tryb
 * gotowania" sits below "Wielkość tekstu" in RecipeChecklists (C3, item 7).
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl }: RecipeActionsProps) {
  return (
    // The heart's wrapper is a flex column so it stretches to full width; from sm
    // the heart and "Udostępnij" share the row, each taking half. From lg both
    // shrink to their content and sit left (#494) — a stretched pair reads as
    // oversized in the desktop text column.
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch lg:justify-start">
      <div className="flex flex-col sm:flex-1 lg:flex-none lg:items-start">
        <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      </div>
      <ShareButton title={title} url={shareUrl} className={`${SECONDARY_BUTTON} sm:flex-1 lg:flex-none`} />
    </div>
  )
}
