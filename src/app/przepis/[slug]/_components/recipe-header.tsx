import Image from 'next/image'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import { categoryLabel } from '@/lib/recipe-categories'
import { sourceLabel, type RecipeSource } from '@/lib/recipe-source'
import { recipeMetaLine } from '@/lib/recipe-meta'
import { tagLabel } from '@/lib/recipe-tags'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { categoryListPath, profilePath } from '@/lib/routes'

export interface RecipeHeaderData {
  title: string
  description: string | null
  meta_description: string | null
  image_url: string | null
  category: string
  tags: string[]
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
  /** Tag chips filter "Moje przepisy" (/recipes, owner-only), so they link only for a signed-in visitor. */
  isAuthenticated: boolean
}

const TAG_CHIP =
  'inline-flex min-h-[48px] items-center rounded-pill border-2 border-border-accent bg-surface-accent px-4 text-[16px] font-bold text-action-text'

/**
 * The recipe page header (E01-S07): 4:3 photo, breadcrumbs, 32 px title,
 * "Kategoria · czas", source with "Otwórz oryginał", and who added it.
 */
export function RecipeHeader({ recipe, isAuthenticated }: RecipeHeaderProps) {
  const category = categoryLabel(recipe.category)
  const categoryHref = categoryListPath(recipe.category)
  const authorHref = profilePath(recipe.author_username)
  const [before, after] = recipeMetaLine(recipe).split('≈ ')

  return (
    <header className="mb-8">
      {recipe.image_url && (
        <div className="relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-card bg-surface-3">
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
            unoptimized={!isArchivedImageUrl(recipe.image_url)}
          />
        </div>
      )}

      <nav aria-label="Okruszki" className="mb-2 text-[16px] text-ink-soft">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link href="/" className="underline hover:text-action-hover">
              Strona główna
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            {categoryHref ? (
              <Link href={categoryHref} className="underline hover:text-action-hover">
                {category}
              </Link>
            ) : (
              category
            )}
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="line-clamp-1">
            {recipe.title}
          </li>
        </ol>
      </nav>

      <h1 className="mb-2 text-[32px] font-bold leading-tight text-ink">{recipe.title}</h1>
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

      {/* Gender-neutral until E01-S12 supplies gender ("Dodała/Dodał"); a link once
          E01-S14 turns profilePath on, so it never points at a 404. */}
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

      {recipe.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tagi">
          {recipe.tags.map((tag) => (
            <li key={tag}>
              {isAuthenticated ? (
                <Link href={`/recipes?tag=${tag}`} className={`${TAG_CHIP} hover:bg-surface-accent-2`}>
                  {tagLabel(tag)}
                </Link>
              ) : (
                <span className={TAG_CHIP}>{tagLabel(tag)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
