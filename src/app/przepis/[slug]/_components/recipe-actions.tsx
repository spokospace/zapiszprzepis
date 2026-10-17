import { FavoriteButton } from '@/app/components/favorite-button'

interface RecipeActionsProps {
  recipeId: number
  isFavorite: boolean
  isAuthenticated: boolean
}

/**
 * The recipe page's action row (E01-S07). The heart's behaviour belongs to E01-S06
 * (FavoriteButton is passed through unchanged). E01-S08's "Tryb gotowania" sits below
 * "Wielkość tekstu" in RecipeChecklists (design handoff C3, item 7).
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated }: RecipeActionsProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
    </div>
  )
}
