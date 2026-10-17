import Image from 'next/image'
import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
import { formatMinutes } from '@/lib/format-minutes'
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
   * `tile` (default): the grid card. `row` (E01-S05 search results): a 96 px
   * thumbnail beside the text, unframed so the caller can frame the list item.
   */
  variant?: 'tile' | 'row'
  /** Row only: total time, shown as "Zupy · 45 min" under the title (left out when unknown). */
  minutes?: number | null
}

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
}: RecipeCardProps) {
  const heart = favorite && (
    <FavoriteButton
      recipeId={favorite.recipeId}
      initialFavorited={favorite.favorited}
      isAuthenticated={favorite.isAuthenticated}
      size="compact"
    />
  )

  if (variant === 'row') {
    return (
      <article>
        {/* Only the title is underlined: it names the link; the meta lines would just be noise. */}
        <Link href={recipePath(slug, { from })} className="group flex gap-3 p-2.5 no-underline!">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-field bg-surface-3">
            {imageUrl ? (
              // The title sits right beside it, so the image is decorative here.
              <Image src={imageUrl} alt="" fill className="object-cover" sizes="96px" unoptimized={!isArchivedImageUrl(imageUrl)} />
            ) : (
              <div aria-hidden="true" className="h-full w-full bg-surface-accent-2" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-3 text-[20px] leading-snug font-bold text-ink underline underline-offset-4 group-hover:text-action-text">
              {title}
            </h3>
            <p className="mt-1 text-[16px] text-ink-soft">
              {minutes ? `${categoryLabel(category)} · ${formatMinutes(minutes)}` : categoryLabel(category)}
            </p>
            <p className="mt-0.5 text-[16px] text-ink-soft">{sourceLabel(sourceType, sourceUrl, sourceAuthor)}</p>
          </div>
        </Link>
        {heart && <div className="px-2.5 pb-2.5">{heart}</div>}
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
        <h3 className="line-clamp-3 text-[19px] leading-snug font-bold text-ink group-hover:text-action-text">
          <Link href={recipePath(slug, { from })} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {description && <p className="mt-1 line-clamp-2 text-[16px] text-ink-soft">{description}</p>}
        <p className="mt-1 text-[16px] text-ink-soft">{sourceLabel(sourceType, sourceUrl, sourceAuthor)}</p>
        <span className="mt-2 inline-block rounded-pill bg-surface-accent-2 px-2.5 py-0.5 text-[16px] font-bold text-action-text">
          {categoryLabel(category)}
        </span>
      </div>

      {heart && <div className="relative z-10 px-3 pb-3">{heart}</div>}
    </article>
  )
}
