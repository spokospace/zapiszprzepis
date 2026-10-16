import Image from 'next/image'
import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
import { sourceLabel, type RecipeSource } from '@/lib/recipe-source'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'

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
    <Link href={`/recipes/${slug}`}>
      <div className="group cursor-pointer rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
        {/* Image container */}
        <div className="relative w-full aspect-[4/3] bg-gray-100">
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
              <svg
                className="w-12 h-12 text-orange-400"
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
        <div className="p-4">
          <h3 className="font-medium text-gray-900 line-clamp-2 group-hover:text-orange-600">
            {title}
          </h3>
          {description && <p className="mt-1 text-sm text-gray-500 line-clamp-1">{description}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-block px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              {categoryLabel(category)}
            </span>
            <span className="truncate text-xs text-gray-400">{sourceLabel(sourceType, sourceUrl, sourceAuthor)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
