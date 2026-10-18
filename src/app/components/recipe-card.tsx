import Image from 'next/image'
import Link from 'next/link'
import { CATEGORY_ICONS, categoryLabel, isRecipeCategory } from '@/lib/recipe-categories'
import { listCardLines } from '@/lib/recipe-meta'
import { sourceLabel, type RecipeSource } from '@/lib/recipe-source'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'
import type { ListKey } from '@/lib/recipe-list-context'
import { FavoriteButton } from './favorite-button'

interface RecipeCardProps {
  slug: string
  title: string
  imageUrl?: string | null
  category: string
  /** Short note that tells same-titled recipes apart ("z rowkami, na żółtkach"). */
  description?: string | null
  sourceType: RecipeSource
  sourceUrl: string | null
  sourceAuthor: string | null
  /** The list this card sits in, for the recipe page's list bar (E01-S07). */
  from?: ListKey
  /** The heart on the card's photo (E01-S06); no heart without it. */
  favorite?: { recipeId: number; favorited: boolean; isAuthenticated: boolean }
  /**
   * `tile` (default): the grid card (home, Ulubione, Moje przepisy, Podobne).
   * `list` (E01-S22): the one list card of search, category and profile — on a
   * phone the photo across the card's full width over the title, from sm a
   * thumbnail beside it.
   */
  variant?: 'tile' | 'list'
  /** List only: total time ("Zupy · 45 min"), left out when unknown. */
  minutes?: number | null
  /** List only: from sm a 96 px thumbnail + 20 px title (search, C2) or 84 + 19 (category 6, profile 7). */
  thumb?: 84 | 96
  /** List only, on a category page: "czas · źródło" and these tag labels instead of the category. */
  inCategory?: { tagLabels: readonly string[] }
  /**
   * Tile only: the image's `sizes`, matching the caller's grid (#253). The default fits
   * Moje przepisy (one column on a phone); the carousel passes CAROUSEL_SIZES, Ulubione TILE_SIZES_1_TO_3.
   */
  sizes?: string
}

/** The list cards' container: one column, two from lg so they don't stretch to 1088 px (E01-S17). */
export const LIST_CARDS_CLASS = 'flex flex-col gap-3 lg:grid lg:grid-cols-2'

/**
 * A row of tiles inside a page (home "Ostatnio dodane", recipe "Podobne"). On a
 * phone it is a swipeable strip running to the screen edges (it cancels
 * PageContainer's px-4), each card ~3/4 of the width so the next one peeks in;
 * from sm the 2-column grid, 4 from lg (E01-S17). Put each card in a
 * CAROUSEL_ITEM_CLASS <li>. The strip scrolls inside itself, so the page never
 * scrolls sideways; its links stay reachable with Tab, which scrolls them in.
 */
export const CAROUSEL_CLASS =
  '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-5'

/** One card of CAROUSEL_CLASS: 3/4 of the screen on a phone, a grid cell from sm. */
export const CAROUSEL_ITEM_CLASS = 'w-3/4 shrink-0 snap-start sm:w-auto'

/**
 * The photo slot of a recipe without a photo: its category icon on the accent
 * tint, so a full-width slot on a phone does not read as an image that failed
 * to load. Decorative: the title and the category line name the recipe.
 */
function NoPhoto({ category, iconClassName }: { category: string; iconClassName: string }) {
  const Icon = isRecipeCategory(category) ? CATEGORY_ICONS[category] : CATEGORY_ICONS.inne
  return (
    <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-surface-accent-2">
      <Icon strokeWidth={1.5} className={`text-action-text ${iconClassName}`} />
    </div>
  )
}

// A tile's `sizes` per grid, so a phone fetches an archived image at the width the card
// really has, not the whole screen (#253). The grids sit in PageContainer: 68rem
// (1088 px) of content at most, so from there a column has a fixed width. In rem, like
// Tailwind's breakpoints and widths: with a larger browser font a grid keeps fewer
// columns longer, and px values would then pick a blurry, too-small image.
/**
 * CAROUSEL_CLASS (home „Ostatnio dodane”, Podobne): 3/4 of the strip on a phone,
 * 0.75 × (100vw − 2rem); two a row from sm; four from lg, (68 − 3 × 1.25) / 4 ≈ 16.1rem (257 px).
 */
export const CAROUSEL_SIZES = '(min-width: 64rem) 16.1rem, (min-width: 40rem) 50vw, calc(75vw - 1.5rem)'
/** Ulubione: one a row on a phone (100vw − 2rem), three from sm, (68 − 2 × 0.75) / 3 ≈ 22.2rem (355 px) at most. */
export const TILE_SIZES_1_TO_3 = '(min-width: 72rem) 22.2rem, (min-width: 40rem) 33vw, calc(100vw - 2rem)'

export function RecipeCard({
  slug,
  title,
  imageUrl,
  category,
  description,
  sourceType,
  sourceUrl,
  sourceAuthor,
  from,
  favorite,
  variant = 'tile',
  minutes,
  thumb = 96,
  inCategory,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: RecipeCardProps) {
  // The top-right corner of the card: on the photo on a phone and on a tile; beside
  // the title of a list card from sm, whose text column leaves it room (sm:pr-14).
  const heart = favorite && (
    <div className="absolute top-2 right-2 z-10">
      <FavoriteButton
        recipeId={favorite.recipeId}
        initialFavorited={favorite.favorited}
        isAuthenticated={favorite.isAuthenticated}
        size="photo"
        recipeTitle={title}
      />
    </div>
  )

  if (variant === 'list') {
    const lines = listCardLines({
      category,
      minutes: minutes ?? null,
      source: sourceLabel(sourceType, sourceUrl, sourceAuthor),
      tagLabels: inCategory?.tagLabels,
      inCategory: Boolean(inCategory),
    })
    // No overflow-hidden on the frame: it would clip the focus outline of the link.
    return (
      <article className="@container relative flex h-full flex-col rounded-card border-2 border-border-card bg-white">
        {/* Only the title is underlined: it names the link; the meta lines would just be noise. */}
        <Link
          href={recipePath(slug, { from })}
          className="group flex flex-1 flex-col rounded-[14px] no-underline! sm:flex-row sm:gap-3 sm:p-3"
        >
          {/* A phone gets the photo across the whole card, 4:3 like the tiles; from sm it is a
              thumbnail beside the title, and a card there is always wider than the old 280 px cut. */}
          <div
            className={`relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-[14px] bg-surface-3 sm:aspect-auto sm:rounded-[12px] ${thumb === 84 ? 'sm:h-[84px] sm:w-[84px]' : 'sm:h-24 sm:w-24'}`}
          >
            {imageUrl ? (
              // The title sits right under (or beside) it, so the image is decorative here.
              <Image
                src={imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes={`(min-width: 40rem) ${thumb === 84 ? '84px' : '6rem'}, calc(100vw - 2rem)`}
                unoptimized={!isArchivedImageUrl(imageUrl)}
              />
            ) : (
              <NoPhoto category={category} iconClassName="h-14 w-14 sm:h-9 sm:w-9" />
            )}
          </div>
          <div className={`flex min-w-0 flex-col gap-1.5 p-3 sm:p-0 ${favorite ? 'sm:pr-14' : ''}`}>
            {/* Two lines at most (C2), words wrapped whole. A tiny card gets 18 px and a third line,
                so a long word still fits instead of being cut; only a word wider than that breaks. */}
            <h3
              className={`line-clamp-2 leading-[1.25] font-bold break-words text-ink underline underline-offset-4 group-hover:text-action-text @max-[280px]:line-clamp-3 @max-[280px]:text-[18px] ${thumb === 84 ? 'text-[19px]' : 'text-[20px]'}`}
            >
              {title}
            </h3>
            {lines.map((line) => (
              <p key={line} className="text-[16px] leading-snug break-words text-ink-soft">
                {line}
              </p>
            ))}
          </div>
        </Link>
        {heart}
      </article>
    )
  }

  // The title link is stretched over the whole card, so the card stays one big
  // target while the heart is a sibling, not a control nested inside a link.
  return (
    <article className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-card border border-border-card bg-white transition-shadow hover:shadow-lg">
      {/* Image container */}
      <div className="relative aspect-[4/3] w-full bg-surface-3">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
            sizes={sizes}
            unoptimized={!isArchivedImageUrl(imageUrl)}
          />
        ) : (
          <NoPhoto category={category} iconClassName="h-12 w-12" />
        )}
      </div>

      {/* Card content */}
      <div className="flex-1 p-3">
        <h3 className="line-clamp-3 text-[19px] leading-snug font-bold break-words text-ink group-hover:text-action-text">
          <Link href={recipePath(slug, { from })} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {description && <p className="mt-1 line-clamp-2 text-[16px] text-ink-soft">{description}</p>}
        <p className="mt-1 text-[16px] break-words text-ink-soft">{sourceLabel(sourceType, sourceUrl, sourceAuthor)}</p>
        <span className="mt-2 inline-block rounded-pill bg-surface-accent-2 px-2.5 py-0.5 text-[16px] font-bold text-action-text">
          {categoryLabel(category)}
        </span>
      </div>

      {heart}
    </article>
  )
}
