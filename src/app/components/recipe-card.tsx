import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatSource, type RecipeSource } from '@/lib/recipe-source'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'
import type { ListKey } from '@/lib/recipe-list-context'
import { FavoriteButton } from './favorite-button'
import { NoPhoto } from './no-photo'
import { SourceBadge } from './source-badge'

interface RecipeCardProps {
  slug: string
  title: string
  imageUrl?: string | null
  /** Only for the no-photo placeholder's category icon. */
  category: string
  /** Short note that tells same-titled recipes apart ("z musem jabłkowym"). */
  description?: string | null
  sourceType: RecipeSource
  sourceUrl: string | null
  sourceAuthor: string | null
  /** The list this card sits in, for the recipe page's back link (E01-S07). */
  from?: ListKey
  /** The heart on the card's photo (E01-S06); no heart without it. */
  favorite?: { recipeId: number; favorited: boolean; isAuthenticated: boolean }
  /**
   * Photo height (E01-S31 §2). `list` (default): a full-width card in the
   * one-column list / grid — 210 px on a phone, 180 from md. `carousel`: a card
   * in a scrolling strip (Podobne, Inne przepisy, home rows) — 170 px, 180 from md.
   */
  photo?: 'list' | 'carousel'
  /** The image's `sizes`, matching the caller's grid (#253). */
  sizes?: string
  /** Extra content under the subtitle — the versions row's time and diffs (E01-S31 §4). */
  children?: ReactNode
}

// A card's `sizes` per grid, so a phone fetches an archived image at the width the card
// really has, not the whole screen (#253). The grids sit in PageContainer: 68rem
// (1088 px) of content at most, so from there a column has a fixed width. In rem, like
// Tailwind's breakpoints and widths: with a larger browser font a grid keeps fewer
// columns longer, and px values would then pick a blurry, too-small image.
/**
 * CardCarousel (home „Ostatnio dodane”, Podobne): 3/4 of the strip on a phone,
 * 0.75 × (100vw − 2rem); two a row from sm; four from lg, (68 − 3 × 1.25) / 4 ≈ 16.1rem (257 px).
 */
export const CAROUSEL_SIZES = '(min-width: 64rem) 16.1rem, (min-width: 40rem) 50vw, calc(75vw - 1.5rem)'
/** Ulubione: one a row on a phone (100vw − 2rem), three from sm, (68 − 2 × 0.75) / 3 ≈ 22.2rem (355 px) at most. */
export const TILE_SIZES_1_TO_3 = '(min-width: 72rem) 22.2rem, (min-width: 40rem) 33vw, calc(100vw - 2rem)'
/** The list grid (search, category, profile, Moje przepisy): a phone gets the full width, md 3 cols, lg 4 cols (E01-S31 §2). */
export const LIST_SIZES = '(min-width: 64rem) 16.1rem, (min-width: 48rem) 33vw, calc(100vw - 2rem)'

/**
 * The list container (E01-S31 §2, ZMIANY_prototyp §6): one column on a phone; from md a
 * grid that auto-fills 200 px columns, so 768–1024 px gets 3 roomy cards rather than 4
 * squished ones, and wider screens add columns on their own.
 */
export const LIST_CARDS_CLASS =
  'flex flex-col gap-10 md:grid md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-x-6 md:gap-y-8'

const PHOTO_HEIGHT = {
  list: 'h-[210px] md:h-[180px]',
  carousel: 'h-[170px] md:h-[180px]',
} as const

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
  photo = 'list',
  sizes = LIST_SIZES,
  children,
}: RecipeCardProps) {
  const source = formatSource(sourceType, sourceUrl, sourceAuthor)
  const cover = coverImageSrc(imageUrl)

  // The title link is stretched over the whole card, so the card is one big
  // target while the heart is a sibling, not a control nested inside a link.
  return (
    <article className="group relative flex h-full flex-col">
      <div className={`relative w-full shrink-0 overflow-hidden rounded-tile bg-surface-3 ${PHOTO_HEIGHT[photo]}`}>
        {cover ? (
          <Image
            src={cover}
            // The title sits right under it and names the card's link, so the image is decorative:
            // empty alt plus aria-hidden keeps it out of the a11y tree and makes the intent explicit.
            alt=""
            aria-hidden
            fill
            className="object-cover transition-opacity group-hover:opacity-[.92]"
            sizes={sizes}
          />
        ) : (
          <NoPhoto category={category} iconClassName="h-12 w-12" />
        )}
        {/* Source on the photo, bottom-left; pointer-events-none so the whole card still
            leads to the recipe (handoff §1: the badge is not a link on a card). */}
        <div className="pointer-events-none absolute bottom-1.5 left-px z-10 max-w-[calc(100%-1px)]">
          <SourceBadge kind={source.kind} text={source.text} variant="card" />
        </div>
        {favorite && (
          <div className="absolute top-2 right-2 z-10">
            <FavoriteButton
              recipeId={favorite.recipeId}
              initialFavorited={favorite.favorited}
              isAuthenticated={favorite.isAuthenticated}
              size="photo"
              recipeTitle={title}
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-2">
        {/* Two lines at most, words wrapped whole (handoff §1). */}
        <h3 className="line-clamp-2 text-[21px] leading-[1.25] font-bold break-words text-ink group-hover:text-action-text">
          <Link href={recipePath(slug, { from })} className="no-underline! after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {description && <p className="line-clamp-2 text-[17px] leading-snug text-ink-soft">{description}</p>}
        {children}
      </div>
    </article>
  )
}
