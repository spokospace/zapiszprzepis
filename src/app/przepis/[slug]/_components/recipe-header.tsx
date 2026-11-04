import type { ReactNode } from 'react'
import Link from 'next/link'
import { Clock, Flame, Timer, Utensils, type LucideIcon } from 'lucide-react'
import { categoryLabel } from '@/lib/recipe-categories'
import { formatSource, type RecipeSource } from '@/lib/recipe-source'
import { recipeTimeStats } from '@/lib/recipe-meta'
import { servingsCount } from '@/lib/servings'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { SEARCH_PATH, categoryPath, profilePath } from '@/lib/routes'
import { SourceBadge } from '@/app/components/source-badge'
import { NoPhoto } from '@/app/components/no-photo'
import { RecipePhotos } from './recipe-photos'
import { RECIPE_HEADER_GRID } from './recipe-split'

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
  /** Servings the source states (1–99), or null: the time strip's "Wychodzi". */
  servings?: number | null
  source_type: RecipeSource
  source_url: string | null
  source_author: string | null
  author_name: string | null
  author_username?: string | null
}

interface RecipeHeaderProps {
  recipe: RecipeHeaderData
  /**
   * The gallery photos a signed-in reader can see, under the main photo as thumbnails
   * (handoff 2026-10-28). Empty for a guest, who gets the cover only.
   */
  galleryImages?: string[]
  /** E01-S21: the "N innych wersji tego dania" box, last in the text column. */
  versionsBar?: ReactNode
  /** The action buttons (RecipeActions), under the time strip in the text column. */
  actions?: ReactNode
}

export interface TimeStripItem {
  key: 'prep' | 'cook' | 'total' | 'yield'
  label: string
  value: string
  /** Times carry the recipe's "≈" when they are estimated; the yield never does. */
  estimated: boolean
}

const STRIP_KEY = { Przygotowanie: 'prep', Gotowanie: 'cook', Łącznie: 'total' } as const
const STRIP_ICON: Record<TimeStripItem['key'], LucideIcon> = { prep: Clock, cook: Flame, total: Timer, yield: Utensils }

/**
 * The time strip's items (handoff 2026-10-28, §3 item 5): the known times from
 * `recipeTimeStats`, then "Wychodzi" from the stated servings. "Gotowanie" stays even for
 * a bake: no field says which it is, and the handoff asks not to guess. No "Doliczyć …"
 * note either: no field holds a waiting or rising time.
 */
export function timeStripItems(r: RecipeHeaderData): TimeStripItem[] {
  const items: TimeStripItem[] = recipeTimeStats(r).map((s) => ({
    key: STRIP_KEY[s.label],
    label: s.label,
    value: s.value,
    estimated: r.times_estimated,
  }))
  if (r.servings != null) items.push({ key: 'yield', label: 'Wychodzi', value: servingsCount(r.servings), estimated: false })
  return items
}

/** The author's initial for the avatar circle; "?" never shows, a missing name renders no line. */
export function authorInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('pl-PL')
}

/**
 * "Przepisy › {Kategoria} › {Przepis}" (A4/A9; handoff 2026-10-28): on the right of the
 * row above the hero, from lg. The recipe itself is the last crumb, not a link.
 */
export function RecipeBreadcrumbs({ category, title, className = '' }: { category: string; title?: string; className?: string }) {
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
        {title && (
          <>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="min-w-0 wrap-anywhere text-ink">
              {title}
            </li>
          </>
        )}
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
 * The time strip (handoff 2026-10-28): no frame, an icon in a 44 px warm circle beside a
 * label and a 20 px value, in a grid that wraps to fit, at every width. Labels are 16 px,
 * not the mock's 14: secondary text is never under 16 px (ZASADY_PROJEKTU). That is also
 * why a column is 165 px, not the mock's 130: "Przygotowanie" at 16 px beside the circle
 * needs it, and narrower it broke mid-word. Three to a row in the desktop column, two at
 * 390, one at 320.
 */
function TimeStrip({ items }: { items: TimeStripItem[] }) {
  return (
    <ul aria-label="Czas i porcje" className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(165px,1fr))] gap-x-5 gap-y-4">
      {items.map((item) => {
        const Icon = STRIP_ICON[item.key]
        return (
          <li key={item.key} className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-[#fdf1e4]">
              <Icon className="h-[18px] w-[18px] text-action" />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] text-ink-soft">{item.label}</span>
              <span className="block text-[20px] font-extrabold text-ink">
                {item.estimated && <Approx />}
                {item.value}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The recipe page header (E01-S07, S07b; handoff 2026-10-28): two equal columns from lg —
 * the photos | the title, subtitle, who added it and the source,
 * description, time strip, actions and the versions box. One column below lg, photos
 * first. The list position and the breadcrumbs sit in a row above it (the page renders
 * it); the tags render at the bottom of the page, in "Ten przepis jest" (E01-S16).
 */
export function RecipeHeader({ recipe, galleryImages = [], versionsBar, actions }: RecipeHeaderProps) {
  const authorHref = profilePath(recipe.author_username)
  const strip = timeStripItems(recipe)
  const source = formatSource(recipe.source_type, recipe.source_url, recipe.source_author)
  const cover = coverImageSrc(recipe.image_url)
  // The source leads to the original (E01-S31 §3): a link-badge on the photo, or,
  // for a page-less recipe (no URL), a plain border-less badge.
  const sourceBadge = <SourceBadge kind={source.kind} text={source.text} href={recipe.source_url} variant="recipe" />

  return (
    <header className={RECIPE_HEADER_GRID}>
      {cover ? (
        <RecipePhotos cover={cover} title={recipe.title} images={galleryImages} badge={sourceBadge} />
      ) : (
        // No cover: from lg a category-icon placeholder fills the photo column so the
        // two-column header does not collapse to a full-width run (#495). It is a
        // decorative placeholder, not a photo, so the source badge stays inline in the
        // text column (E01-S31 §3), not on it. Hidden below lg — there the badge is inline
        // and no photo block shows, exactly as before.
        <div className="hidden aspect-[4/3] overflow-hidden bg-surface-3 lg:block">
          <NoPhoto category={recipe.category} iconClassName="h-16 w-16" />
        </div>
      )}

      <div>
        {/* No label over the title (owner, 2026-10-29): the breadcrumbs above already
            name the category, and the tags sit at the bottom of the page. */}
        <h1 className="mb-2 text-[32px] leading-[1.15] font-bold text-ink lg:text-[48px] lg:leading-[1.05] lg:font-extrabold">
          {recipe.title}
        </h1>
        {/* The recipe's own short description sits right under the title — a subtitle
            qualifying the dish ("ze smalcem"). */}
        {recipe.description && <p className="mb-3 text-scalable-body text-ink-soft lg:text-[22px]">{recipe.description}</p>}

        {/* With no photo there is no corner for the badge, so it sits here instead
            (E01-S31 §3) — at every width, since the lg placeholder carries no badge. */}
        {!cover && <div className="mb-3 print:hidden">{sourceBadge}</div>}

        {/* Always the neutral "Dodane przez {nazwa}": others never learn the author's
            gender (#376, privacy policy §3). An initial in a warm circle before it (handoff 2026-10-28). No
            "źródło: …" after it, unlike the mock: the source badge already names and
            links the original, on the photo or right above this line (owner, 2026-10-28). */}
        {recipe.author_name && (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] text-ink-soft print:hidden">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-[#fde7d3] font-bold text-action-text"
            >
              {authorInitial(recipe.author_name)}
            </span>
            <span className="min-w-0 break-words">
              Dodane przez{' '}
              {authorHref ? (
                <Link href={authorHref} className="font-bold text-action-text underline hover:text-action-hover">
                  {recipe.author_name}
                </Link>
              ) : (
                <span className="font-bold text-ink">{recipe.author_name}</span>
              )}
            </span>
          </p>
        )}

        {recipe.meta_description && <p className="mt-4 text-scalable-body leading-relaxed text-ink">{recipe.meta_description}</p>}

        {strip.length > 0 && <TimeStrip items={strip} />}

        {actions}
        {versionsBar && <div className="print:hidden">{versionsBar}</div>}
      </div>
    </header>
  )
}
