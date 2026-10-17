import Image from 'next/image'
import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
import { sourceLabel, type RecipeSource } from '@/lib/recipe-source'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'

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
}: RecipeCardProps) {
  return (
    <Link href={recipePath(slug)}>
      <div className="group h-full cursor-pointer overflow-hidden rounded-card border border-border-card bg-white transition-shadow hover:shadow-lg">
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
        <div className="p-3">
          <h3 className="line-clamp-3 text-[19px] leading-snug font-bold break-words text-ink group-hover:text-action-text">
            {title}
          </h3>
          {description && <p className="mt-1 line-clamp-2 text-[16px] text-ink-soft">{description}</p>}
          <p className="mt-1 text-[16px] break-words text-ink-soft">{sourceLabel(sourceType, sourceUrl, sourceAuthor)}</p>
          <span className="mt-2 inline-block rounded-pill bg-surface-accent-2 px-2.5 py-0.5 text-[16px] font-bold text-action-text">
            {categoryLabel(category)}
          </span>
        </div>
      </div>
    </Link>
  )
}
