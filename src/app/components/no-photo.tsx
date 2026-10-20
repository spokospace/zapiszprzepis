import { CATEGORY_ICONS, isRecipeCategory } from '@/lib/recipe-categories'

/**
 * The photo slot of a recipe without a photo: its category icon on the accent
 * tint, so a full-width slot on a phone does not read as an image that failed
 * to load. Decorative: the title and the category line name the recipe.
 */
export function NoPhoto({ category, iconClassName }: { category: string; iconClassName: string }) {
  const Icon = isRecipeCategory(category) ? CATEGORY_ICONS[category] : CATEGORY_ICONS.inne
  return (
    <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-surface-accent-2">
      <Icon strokeWidth={1.5} className={`text-action-text ${iconClassName}`} />
    </div>
  )
}
