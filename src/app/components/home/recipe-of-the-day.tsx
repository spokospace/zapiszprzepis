import Image from 'next/image'
import Link from 'next/link'
import { formatSource, type RecipeSource } from '@/lib/recipe-source'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'
import { SourceBadge } from '../source-badge'

interface RecipeOfTheDayProps {
  slug: string
  title: string
  imageUrl?: string | null
  description?: string | null
  sourceType: RecipeSource
  sourceUrl: string | null
  sourceAuthor: string | null
}

/**
 * „Przepis dnia” (ZMIANY_prototyp §5c): the whole photo is the link to the recipe.
 * A white „Przepis dnia” badge top-left, a dark gradient along the bottom carrying
 * the white title, the subtitle and the source badge. Desktop: 300 px, rounded,
 * shadowed; mobile: full-bleed 260 px with no radius (it breaks out of the hero's
 * padding). The candidate already has a photo and is never a YouTube recipe.
 */
export function RecipeOfTheDay({
  slug,
  title,
  imageUrl,
  description,
  sourceType,
  sourceUrl,
  sourceAuthor,
}: RecipeOfTheDayProps) {
  const source = formatSource(sourceType, sourceUrl, sourceAuthor)
  return (
    <Link
      href={recipePath(slug)}
      aria-label={`Przepis dnia: ${title}`}
      className="group relative -mx-4 -mb-6 block h-[260px] overflow-hidden bg-surface-3 no-underline! focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus sm:-mx-6 md:mx-0 md:mb-0 md:h-[300px] md:rounded-tile md:shadow-[0_10px_30px_rgba(17,24,39,0.12)]"
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(min-width: 768px) 560px, 100vw"
          unoptimized={!isArchivedImageUrl(imageUrl)}
        />
      )}
      <span className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-tile bg-white px-2.5 py-1 text-[16px] font-bold text-action-text">
        Przepis dnia
      </span>
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-4 pt-16"
        style={{ backgroundImage: 'linear-gradient(180deg, transparent, rgba(17,24,39,.82) 46%, rgba(17,24,39,.9))' }}
      >
        <h2 className="text-[24px] leading-tight font-bold break-words text-white group-hover:underline md:text-[28px]">
          {title}
        </h2>
        {description && <p className="line-clamp-1 text-[17px] text-white/90">{description}</p>}
        <div className="max-w-[calc(100%-1rem)]">
          <SourceBadge kind={source.kind} text={source.text} variant="card" />
        </div>
      </div>
    </Link>
  )
}
