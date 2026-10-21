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
 * „Przepis dnia” (style 1b): the whole block is the link to the recipe. A 4 px photo
 * (desktop 300 px; mobile full-bleed 220 px with no radius, breaking out of the hero's
 * padding) carries the source tab; the label, title and subtitle sit below it, on
 * white. The candidate already has a photo and is never a YouTube recipe.
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
      className="group -mx-4 block no-underline! focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus sm:-mx-6 md:mx-0"
    >
      <div className="relative h-[220px] overflow-hidden bg-surface-3 md:h-[300px] md:rounded-tile">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover transition-opacity group-hover:opacity-[.92]"
            sizes="(min-width: 768px) 560px, 100vw"
            unoptimized={!isArchivedImageUrl(imageUrl)}
          />
        )}
        <div className="absolute bottom-1.5 left-px z-10 max-w-[calc(100%-1px)]">
          <SourceBadge kind={source.kind} text={source.text} variant="card" />
        </div>
      </div>
      <div className="px-4 pt-3 sm:px-6 md:px-0">
        <p className="text-[16px] font-bold tracking-[.08em] text-action-text uppercase">Przepis dnia</p>
        <h2 className="mt-1 text-[24px] leading-tight font-bold break-words text-ink group-hover:underline md:text-[26px]">
          {title}
        </h2>
        {description && <p className="mt-1 line-clamp-2 text-[17px] text-ink-soft">{description}</p>}
      </div>
    </Link>
  )
}
