import Image from 'next/image'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import { categoryLabel } from '@/lib/recipe-categories'
import { sourceLabel, type RecipeSource } from '@/lib/recipe-source'
import { recipeMetaLine } from '@/lib/recipe-meta'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { categoryPath, profilePath } from '@/lib/routes'

export interface RecipeHeaderData {
  title: string
  description: string | null
  meta_description: string | null
  image_url: string | null
  category: string
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  times_estimated: boolean
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  author_name: string | null
  author_username?: string | null
}

interface RecipeHeaderProps {
  recipe: RecipeHeaderData
}

/**
 * The recipe page header (E01-S07): 4:3 photo, breadcrumbs, 32 px title,
 * "Kategoria · czas", source with "Otwórz oryginał", and who added it. The tags
 * render at the bottom of the page, in "Ten przepis jest" (E01-S16).
 */
export function RecipeHeader({ recipe }: RecipeHeaderProps) {
  const category = categoryLabel(recipe.category)
  const authorHref = profilePath(recipe.author_username)
  const [before, after] = recipeMetaLine(recipe).split('≈ ')

  return (
    // Desktop (E01-S17, A9): a 16:10 photo | the text column (1.2fr 1fr) when there is a photo.
    <header className={`mb-8 ${recipe.image_url ? 'lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-10' : ''}`}>
      {recipe.image_url && (
        <div className="relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-card bg-surface-3 lg:mb-0 lg:aspect-[16/10]">
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 768px, 600px"
            className="object-cover"
            priority
            unoptimized={!isArchivedImageUrl(recipe.image_url)}
          />
        </div>
      )}

      <div>
        <nav aria-label="Okruszki" className="mb-2 text-[16px] text-ink-soft">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li>
              <Link href="/" className="underline hover:text-action-hover">
                Strona główna
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link href={categoryPath(recipe.category)} className="underline hover:text-action-hover">
                {category}
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="line-clamp-1">
              {recipe.title}
            </li>
          </ol>
        </nav>

        <h1 className="mb-2 text-[32px] font-bold leading-tight text-ink lg:text-[44px] lg:leading-[1.1]">{recipe.title}</h1>
        <p className="mb-3 text-[17px] text-ink-soft">
          {/* "≈" reads as "almost equal to" in screen readers; they get "około" instead. */}
          {before}
          {after != null && (
            <>
              <span aria-hidden="true">≈ </span>
              <span className="sr-only">około </span>
              {after}
            </>
          )}
        </p>

        <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] text-ink">
          <Globe aria-hidden="true" size={20} className="shrink-0 text-ink-soft" />
          <span>Źródło: {sourceLabel(recipe.source_type, recipe.source_url, recipe.source_author)}</span>
          {recipe.source_url && (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] items-center font-bold text-action-text underline hover:text-action-hover"
              >
                Otwórz oryginał
                <span className="sr-only"> (otwiera nową kartę)</span>
              </a>
            </>
          )}
        </p>

        {/* Gender-neutral on purpose: gender is owner-only (E01-S12), so no public
            "Dodała/Dodał" (E01-S14 spec A1). A link to /u/{username} when the author
            has a username, plain text otherwise. */}
        {recipe.author_name && (
          <p className="text-[17px] text-ink-soft">
            Dodane przez{' '}
            {authorHref ? (
              <Link href={authorHref} className="font-bold text-ink underline hover:text-action-hover">
                {recipe.author_name}
              </Link>
            ) : (
              <span className="font-bold text-ink">{recipe.author_name}</span>
            )}
          </p>
        )}

        {recipe.description && <p className="mt-4 text-[19px] text-ink-soft">{recipe.description}</p>}
        {recipe.meta_description && <p className="mt-3 text-[19px] leading-relaxed text-ink">{recipe.meta_description}</p>}
      </div>
    </header>
  )
}
