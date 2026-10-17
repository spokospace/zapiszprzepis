import { FavoriteButton } from '@/app/components/favorite-button'
import { loginPath, favoriteReturnPath } from '@/lib/login-redirect'

interface RecipeActionsProps {
  recipeId: number
  slug: string
  isFavorite: boolean
  isAuthenticated: boolean
  /** The page was reached with ?fav=1 after the guest heart's login round-trip. */
  autoAddFavorite: boolean
}

/**
 * The recipe page's action row (E01-S07). The heart's behaviour belongs to E01-S06
 * (FavoriteButton is passed through unchanged); E01-S08 mounts "Tryb gotowania" here.
 */
export function RecipeActions({ recipeId, slug, isFavorite, isAuthenticated, autoAddFavorite }: RecipeActionsProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <FavoriteButton
        recipeId={recipeId}
        initialFavorited={isFavorite}
        isAuthenticated={isAuthenticated}
        loginHref={loginPath(favoriteReturnPath(slug))}
        autoAdd={autoAddFavorite}
      />
      {/* E01-S08: <CookingModeButton … /> */}
    </div>
  )
}
