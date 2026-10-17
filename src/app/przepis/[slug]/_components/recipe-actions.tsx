import { FavoriteButton } from '@/app/components/favorite-button'

interface RecipeActionsProps {
  recipeId: number
  isFavorite: boolean
  isAuthenticated: boolean
}

/**
 * The recipe page's action row (E01-S07). The heart's behaviour belongs to E01-S06
 * (FavoriteButton is passed through unchanged); E01-S08 mounts "Tryb gotowania" here.
 */
export function RecipeActions({ recipeId, isFavorite, isAuthenticated }: RecipeActionsProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <FavoriteButton recipeId={recipeId} initialFavorited={isFavorite} isAuthenticated={isAuthenticated} />
      {/* E01-S08: <CookingModeButton … /> */}
    </div>
  )
}
