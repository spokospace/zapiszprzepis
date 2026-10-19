import { ExternalLink } from 'lucide-react'
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
  sourceUrl: string | null
}

// 48 px below lg; from lg 58 px like the heart beside it (lg: so it outranks the size's own min-height).
const SECONDARY_BUTTON = `${buttonClasses('outline', 'md')} lg:min-h-[58px] lg:text-[18px]`

/**
 * The recipe page's action row (E01-S07), last in the header's text column. Below
 * lg the full-width heart (C3, item 5) with "Udostępnij" under it — added on phones
 * at the owner's request (C3 has none), where the share sheet is most useful. From
 * lg the A9 buttons "W ulubionych" / "Udostępnij" / "Oryginał" — the heart across
 * the column and the other two side by side under it, since the three labels do not
 * fit one row of the ~480 px column without breaking a word. The heart's behaviour
 * belongs to E01-S06 (FavoriteButton is passed through unchanged). Below lg the original is the
 * outlined button at the end of the recipe (C3, item 11). E01-S08's "Tryb
 * gotowania" sits below "Wielkość tekstu" in RecipeChecklists (C3, item 7).
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, shareUrl, sourceUrl }: RecipeActionsProps) {
  return (
    // A column below sm and the heart's wrapper a flex column, so the heart stretches
    // to full width there and from lg (a signed-in heart has its own wrapper too).
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start lg:grid lg:grid-cols-2">
      <div className="flex flex-col lg:col-span-2">
        <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      </div>
      <ShareButton title={title} url={shareUrl} className={SECONDARY_BUTTON} />
      <div className="hidden lg:contents">
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={SECONDARY_BUTTON}>
            <ExternalLink aria-hidden="true" size={22} className="shrink-0" />
            Oryginał
            <span className="sr-only"> przepisu (otwiera nową kartę)</span>
          </a>
        )}
      </div>
    </div>
  )
}
