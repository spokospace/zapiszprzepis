import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { categoryLabel } from '@/lib/recipe-categories'
import { formatSource, type RecipeSource } from '@/lib/recipe-source'
import { recipeMetaLine, recipeTimeStats } from '@/lib/recipe-meta'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { SEARCH_PATH, categoryPath, profilePath } from '@/lib/routes'
import { authorLinePrefix, parseGenderForm } from '@/lib/gender-form'
import { SourceBadge } from '@/app/components/source-badge'

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
  /** 'f' | 'm' | null from the E01-S23 view column; missing before that migration → neutral. */
  author_gender_form?: string | null
}

interface RecipeHeaderProps {
  recipe: RecipeHeaderData
  /** E01-S21: the "N inne przepisy na {danie}" bar, under the author line. */
  versionsBar?: ReactNode
  /** The favourite (and from lg "Udostępnij" / "Oryginał") row, last in the text column (A9). */
  actions?: ReactNode
}

/**
 * "Przepisy › {Kategoria}" (A4/A9): in the header column below lg, and from lg on
 * the right of the list bar's row (the page renders that copy). "Przepisy" goes
 * where the desktop header's "Przepisy" goes (E01-S17).
 */
export function RecipeBreadcrumbs({ category, className = '' }: { category: string; className?: string }) {
  return (
    <nav aria-label="Okruszki" className={`text-[16px] text-ink-soft ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          <Link href={SEARCH_PATH} className="underline hover:text-action-hover">
            Przepisy
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li>
          <Link href={categoryPath(category)} className="font-bold text-action-text underline hover:text-action-hover">
            {categoryLabel(category)}
          </Link>
        </li>
      </ol>
    </nav>
  )
}

/** "≈" reads as "almost equal to" in screen readers; they get "około" instead. */
function Approx() {
  return (
    <>
      <span aria-hidden="true">≈ </span>
      <span className="sr-only">około </span>
    </>
  )
}

/**
 * The recipe page header (E01-S07, S07b): 4:3 photo, 32 px title, "Kategoria ·
 * czas" (from lg the A9 times row), source, who added it, and the actions. No
 * breadcrumbs below lg (C3); from lg they are in the page's A9 row. The tags render at the bottom of the page, in
 * "Ten przepis jest" (E01-S16).
 */
export function RecipeHeader({ recipe, versionsBar, actions }: RecipeHeaderProps) {
  const authorHref = profilePath(recipe.author_username)
  const [before, after] = recipeMetaLine(recipe).split('≈ ')
  const times = recipeTimeStats(recipe)
  const source = formatSource(recipe.source_type, recipe.source_url, recipe.source_author)
  const cover = coverImageSrc(recipe.image_url)
  // The source leads to the original (E01-S31 §3): a link-badge on the photo, or,
  // for a page-less recipe (no URL), a plain border-less badge.
  const sourceBadge = <SourceBadge kind={source.kind} text={source.text} href={recipe.source_url} variant="recipe" />

  return (
    // Desktop (E01-S17, A9): a 16:10 photo | the text column (1.2fr 1fr) when there is a photo.
    // Top-aligned: with the actions in the text column it is usually the taller one,
    // and a centred photo would float in white space.
    <header className={`mb-8 ${cover ? 'lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-10' : ''}`}>
      {cover && (
        // Below lg the cover is full-bleed (E01-S07b): it breaks out of the page
        // container's side padding (-mx-4 sm:-mx-6, matching PageContainer's px) and
        // cancels <main>'s top padding (-mt-6 sm:-mt-8), so it sits flush to the screen
        // edges and to the top under the app header, square-cornered. From lg it returns
        // to the padded A9 grid: rounded 16:10 inside its column. `w-full` is dropped so
        // the block's auto width expands with the negative margins to the viewport edges;
        // the container never binds max-width below lg, so edge-to-edge is exact (no
        // overflow — guarded by test:reflow).
        <div className="relative mb-5 -mx-4 -mt-6 aspect-[4/3] overflow-hidden rounded-none bg-surface-3 sm:-mx-6 sm:-mt-8 lg:mx-0 lg:mt-0 lg:mb-0 lg:aspect-[16/10] lg:rounded-tile">
          <Image
            // The LCP image, served from Supabase Storage through next/image.
            src={cover}
            alt={recipe.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 768px, 600px"
            className="object-cover"
            priority
          />
          {/* Source on the photo, bottom-left (E01-S31 §3). */}
          <div className="absolute bottom-0 left-px z-10 max-w-[calc(100%-1px)]">{sourceBadge}</div>
        </div>
      )}

      <div>
        {/* No breadcrumbs below lg (C3): the header leads back to the list and the
            category is in the line under the title. From lg they sit in the A9 row. */}
        <h1 className="mb-2 text-[32px] leading-[1.15] font-bold text-ink lg:text-[44px] lg:leading-[1.1]">{recipe.title}</h1>
        {/* The recipe's own short description sits right under the title, not after the
            times row (owner request) — a subtitle qualifying the dish ("ze smalcem"). */}
        {recipe.description && <p className="mb-3 text-scalable-body text-ink-soft">{recipe.description}</p>}
        {/* Below lg (C3). From lg the category is in the breadcrumbs and the times get
            their own row (A9). */}
        <p className="mb-3 text-[17px] text-ink-soft lg:hidden">
          {before}
          {after != null && (
            <>
              <Approx />
              {after}
            </>
          )}
        </p>

        {/* With no photo there is no corner for the badge, so it sits here instead (E01-S31 §3). */}
        {!cover && <div className="mb-3">{sourceBadge}</div>}

        {/* "Dodała/Dodał {nazwa}" by the author's grammatical form (E01-S23) — never the
            raw gender, which stays owner-only (E01-S12); neutral "Dodane przez" when
            unknown. A link to /u/{username} when the author has a username. */}
        {recipe.author_name && (
          // C3/A4: a small 16 px line, the name an underlined link in the accent colour.
          <p className="text-[16px] text-ink-soft">
            {authorLinePrefix(parseGenderForm(recipe.author_gender_form))}{' '}
            {authorHref ? (
              <Link href={authorHref} className="text-action-text underline hover:text-action-hover">
                {recipe.author_name}
              </Link>
            ) : (
              <span className="text-ink">{recipe.author_name}</span>
            )}
          </p>
        )}

        {times.length > 0 && (
          // A9: "Przygotowanie / Gotowanie / Łącznie", the values 20 px bold.
          <dl className="mt-4 hidden flex-wrap gap-x-8 gap-y-2 lg:flex">
            {times.map((t) => (
              <div key={t.label}>
                <dt className="text-[16px] text-ink-soft">{t.label}</dt>
                <dd className="text-[20px] font-bold text-ink">
                  {recipe.times_estimated && <Approx />}
                  {t.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {recipe.meta_description && <p className="mt-4 text-scalable-body leading-relaxed text-ink">{recipe.meta_description}</p>}
        {versionsBar}
        {actions}
      </div>
    </header>
  )
}
