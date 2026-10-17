import Image from 'next/image'
import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
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
  /** The labelled heart in the card's footer (E01-S06); no heart without it. */
  favorite?: { recipeId: number; favorited: boolean; isAuthenticated: boolean }
  /**
   * `tile` (default): the grid card (home, Ulubione, Moje przepisy, Podobne).
   * `list` (E01-S22): the one list card of search, category and profile — a
   * thumbnail beside the full title, with the favorites bar inside its frame.
   */
  variant?: 'tile' | 'list'
  /** List only: total time ("Zupy · 45 min"), left out when unknown. */
  minutes?: number | null
  /** List only: 96 px thumbnail + 20 px title (search, C2) or 84 + 19 (category 6, profile 7). */
  thumb?: 84 | 96
  /** List only, on a category page: "czas · źródło" and these tag labels instead of the category. */
  inCategory?: { tagLabels: readonly string[] }
  /**
   * Tile only: the image's `sizes`, matching the caller's grid (#253). The default fits
   * Moje przepisy (one column on a phone); the two-column grids pass a `TILE_SIZES_*`.
   */
  sizes?: string
}

/** The list cards' container: one column, two from lg so they don't stretch to 1088 px (E01-S17). */
export const LIST_CARDS_CLASS = 'flex flex-col gap-3 lg:grid lg:grid-cols-2'

// A tile's `sizes` in a two-column grid, so a phone fetches an archived image at the
// width of half the screen, not all of it (#253). The grids sit in PageContainer:
// 68rem (1088 px) of content at most, so from there a column has a fixed width.
// In rem, like Tailwind's breakpoints and widths: with a larger browser font the grid
// keeps two columns longer, and px values would then pick a blurry, too-small image.
/** Two a row, four from lg (home „Ostatnio dodane”, Podobne): (68 − 3 × 1.25) / 4 ≈ 16.1rem (257 px). */
export const TILE_SIZES_2_TO_4 = '(min-width: 64rem) 16.1rem, 50vw'
/** Two a row, three from sm (Ulubione): (68 − 2 × 0.75) / 3 ≈ 22.2rem (355 px). */
export const TILE_SIZES_2_TO_3 = '(min-width: 72rem) 22.2rem, (min-width: 40rem) 33vw, 50vw'

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
  const heart = (size: 'compact' | 'bar') =>
    favorite && (
      <FavoriteButton
        recipeId={favorite.recipeId}
        initialFavorited={favorite.favorited}
        isAuthenticated={favorite.isAuthenticated}
        size={size}
      />
    )

  if (variant === 'list') {
    const lines = listCardLines({
      category,
      minutes: minutes ?? null,
      source: sourceLabel(sourceType, sourceUrl, sourceAuthor),
      tagLabels: inCategory?.tagLabels,
      inCategory: Boolean(inCategory),
    })
    // No overflow-hidden on the frame: it would clip the focus outline of the link and the bar.
    return (
      <article className="@container flex h-full flex-col rounded-card border-2 border-border-card bg-white">
        {/* Only the title is underlined: it names the link; the meta lines would just be noise. */}
        <Link href={recipePath(slug, { from })} className="group flex flex-1 gap-3 rounded-[14px] p-3 no-underline!">
          {/* Under 280 px of card (320 px at 130 % zoom) a smaller thumbnail leaves the title room for whole words. */}
          <div
            className={`relative shrink-0 overflow-hidden rounded-[12px] bg-surface-3 @max-[280px]:h-16 @max-[280px]:w-16 ${thumb === 84 ? 'h-[84px] w-[84px]' : 'h-24 w-24'}`}
          >
            {imageUrl ? (
              // The title sits right beside it, so the image is decorative here.
              <Image src={imageUrl} alt="" fill className="object-cover" sizes={`${thumb}px`} unoptimized={!isArchivedImageUrl(imageUrl)} />
            ) : (
              <div aria-hidden="true" className="h-full w-full bg-surface-accent-2" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
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
        {heart('bar')}
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
          <div className="flex h-full w-full items-center justify-center bg-surface-accent-2">
            <svg
              aria-hidden="true"
              className="h-12 w-12 text-action-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m0 0h6m0-6H6m0 0H0M12 6h6"
              />
            </svg>
          </div>
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

      {favorite && <div className="relative z-10 px-3 pb-3">{heart('compact')}</div>}
    </article>
  )
}
