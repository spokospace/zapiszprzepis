import { FavoriteButton } from '@/app/components/favorite-button'
import { buttonClasses } from '@/app/components/ui/button'
import { ShareButton } from './share-button'
import { PrintButton } from './print-button'

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
 * column: "Dodaj do ulubionych", then "Udostępnij" and "Drukuj" as a pair. Everything
 * is full width on the phone; from sm the heart shrinks to its content (left, #494) and
 * the Udostępnij / Drukuj pair sits on its own line beside each other. Three content-
 * width buttons do not fit the ~520px desktop text column on one line, so the heart
 * keeps its own line and the secondary pair keeps theirs — no wrapping or squeezing. The
 * original is reached from the source badge on the photo now, so there is no "Oryginał"
 * button here or at the end of the recipe. The heart's behaviour belongs to E01-S06
 * (FavoriteButton is passed through unchanged). E01-S08's "Tryb gotowania" sits below
 * "Wielkość tekstu" in RecipeChecklists (C3, item 7). The whole block is `print:hidden`
 * — none of these controls belongs on paper.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl }: RecipeActionsProps) {
  return (
    <div className="mt-6 flex flex-col gap-3 print:hidden">
      {/* The heart: full width on the phone, content width from sm (sits left, #494). */}
      <div className="flex flex-col sm:items-start">
        <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      </div>
      {/* Udostępnij + Drukuj: stacked on the phone, a content-width pair from sm. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <ShareButton title={title} url={shareUrl} className={SECONDARY_BUTTON} />
        <PrintButton className={SECONDARY_BUTTON} />
      </div>
    </div>
  )
}
