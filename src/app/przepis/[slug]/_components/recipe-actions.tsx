import { FavoriteButton } from '@/app/components/favorite-button'
import { CookingMode } from './cooking-mode'

interface RecipeActionsProps {
  recipeId: number
  isFavorite: boolean
  isAuthenticated: boolean
  title: string
  steps: string[]
}

/**
 * The recipe page's action row (E01-S07). The heart's behaviour belongs to E01-S06
 * (FavoriteButton is passed through unchanged); "Tryb gotowania" is E01-S08.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated, title, steps }: RecipeActionsProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      <CookingMode title={title} steps={steps} />
    </div>
  )
}
