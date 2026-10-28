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
import { NoPhoto } from '@/app/components/no-photo'
import { RECIPE_SPLIT } from './recipe-split'

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
  /**
   * The action cards (RecipeActions): a full-width row under the photo and text between
   * lg and xl, under the description in the text column from xl.
   */
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
    // Desktop (E01-S17, A9): a 4:3 photo | the text column (1fr 1.6fr). The grid
    // applies whether or not there is a cover (#495): a cover-less recipe gets a
    // category-icon placeholder in the photo column so its header keeps the two-column
    // balance instead of stretching full-width. Top-aligned, so a shorter photo or text
    // column never floats. The actions are the header's third item: between lg and xl the
    // text column is too narrow for them beside a 4:3 photo (it would run far past it),
    // so they take a full-width row below both; from xl the photo spans two rows and they
    // sit under the description, the `1fr` row soaking up any height the photo adds.
    <header className={`mb-8 ${RECIPE_SPLIT} xl:grid-rows-[auto_1fr]`}>
      {cover ? (
        // Below lg the cover is full-bleed: its negative margins cancel the horizontal
        // padding of PageContainer (px-4 sm:px-6) and the top padding of <main>
        // (py-6 sm:py-8), so it sits flush to the screen edges and the top. Keep those
        // margins in sync with that padding by hand — test:reflow only catches an
        // over-wide breakout (horizontal scroll), not a gap left by a mismatch. `w-full`
        // is dropped so the block's auto width expands to the viewport (re-adding it would
        // shift, not widen). From lg the photo sits in the ingredients column (the same
        // 1fr | 1.6fr split and gap as RecipeChecklists), so its right edge lines up with
        // „Składniki”, and `bleed-left-page` widens it to the left browser edge. It stays
        // 4:3 at every width, so the height follows the widened photo.
        <div className="recipe-print-cover relative mb-5 -mx-4 -mt-6 aspect-[4/3] sm:-mx-6 sm:-mt-8 lg:mt-0 lg:mr-0 lg:mb-0 lg:bleed-left-page xl:row-span-2">
          <div className="absolute inset-0 overflow-hidden bg-surface-3 lg:rounded-r-tile">
            <Image
              // The LCP image, served from Supabase Storage through next/image.
              src={cover}
              alt={recipe.title}
              fill
              // Full-bleed = 100vw below lg (1024); from lg the column plus the bleed,
              // ~37–40vw up to 1535 px and ~44vw on very wide screens.
              sizes="(max-width: 1023px) 100vw, (max-width: 1535px) 40vw, 45vw"
              className="object-cover"
              priority
            />
            {/* Source on the photo, bottom-left (E01-S31 §3). Hidden on print — the
                printout carries the source in its footer line instead. */}
            <div className="absolute bottom-0 left-px z-10 max-w-[calc(100%-1px)] print:hidden">{sourceBadge}</div>
          </div>
        </div>
      ) : (
        // No cover: from lg a category-icon placeholder fills the photo column so the
        // two-column header does not collapse to a full-width run (#495). It is a
        // decorative placeholder, not a photo, so the source badge stays inline in the
        // text column (E01-S31 §3), not on it. Hidden below lg — there the badge is inline
        // and no photo block shows, exactly as before.
        <div className="hidden aspect-[4/3] overflow-hidden rounded-tile bg-surface-3 lg:block xl:row-span-2">
          <NoPhoto category={recipe.category} iconClassName="h-16 w-16" />
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

        {/* With no photo there is no corner for the badge, so it sits here instead
            (E01-S31 §3) — at every width, since the lg placeholder carries no badge. */}
        {!cover && <div className="mb-3 print:hidden">{sourceBadge}</div>}

        {/* "Dodała/Dodał {nazwa}" by the author's grammatical form (E01-S23) — never the
            raw gender, which stays owner-only (E01-S12); neutral "Dodane przez" when
            unknown. A link to /u/{username} when the author has a username. */}
        {recipe.author_name && (
          // C3/A4: a small 16 px line, the name an underlined link in the accent colour.
          <p className="text-[16px] text-ink-soft print:hidden">
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
        {versionsBar && <div className="print:hidden">{versionsBar}</div>}
      </div>
      {actions && <div className="lg:col-span-2 xl:col-span-1 xl:col-start-2">{actions}</div>}
    </header>
  )
}
