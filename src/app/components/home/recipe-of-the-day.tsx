import Image from 'next/image'
import Link from 'next/link'
import { formatSource, type RecipeSource } from '@/lib/recipe-source'
import { coverImageProps } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'
import { PageContainer } from '../page-container'
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
 * „Przepis dnia” (handoff 14): its own block under a 1 px ink rule, below the hero. The
 * whole block is the link to the recipe. From md two columns (7fr photo, 5fr text,
 * gap 40): a 360 px photo with a 4 px radius and the source tab, then the label, title,
 * subtitle and an underlined „Zobacz przepis →”. On a phone one column with a full-bleed
 * 220 px photo. The candidate already has a photo and is never a YouTube recipe.
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
    <PageContainer>
      <div className="border-t border-ink pt-8 pb-10 md:pb-12">
        <Link
          href={recipePath(slug)}
          aria-label={`Przepis dnia: ${title}`}
          className="group -mx-4 grid gap-5 no-underline! focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus sm:-mx-6 md:mx-0 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:gap-10"
        >
          <div className="relative h-[220px] overflow-hidden bg-surface-3 md:h-[360px] md:rounded-tile">
            {imageUrl && (
              <Image
                // External cover capped (#446): 560px on desktop, full-width on a phone at ~2×.
                {...coverImageProps(imageUrl, 1024)}
                alt=""
                fill
                className="object-cover transition-opacity group-hover:opacity-[.92]"
                sizes="(min-width: 768px) 560px, 100vw"
              />
            )}
            <div className="absolute bottom-1.5 left-px z-10 max-w-[calc(100%-1px)]">
              <SourceBadge kind={source.kind} text={source.text} variant="card" />
            </div>
          </div>
          <div className="flex flex-col gap-3 px-4 sm:px-6 md:px-0">
            <p className="text-[16px] font-bold tracking-[.08em] text-action-text uppercase">Przepis dnia</p>
            <h2 className="text-[28px] leading-[1.08] font-extrabold break-words text-ink md:text-[40px]">{title}</h2>
            {description && <p className="line-clamp-3 text-[19px] text-ink-soft md:text-[20px]">{description}</p>}
            <span className="mt-2 text-[19px] font-bold text-action-text underline underline-offset-4">Zobacz przepis →</span>
          </div>
        </Link>
      </div>
    </PageContainer>
  )
}
