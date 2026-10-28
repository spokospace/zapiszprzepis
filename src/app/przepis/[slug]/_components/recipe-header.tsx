import type { ReactNode } from 'react'
import Link from 'next/link'
import { Clock, Flame, Timer, Utensils, type LucideIcon } from 'lucide-react'
import { categoryLabel } from '@/lib/recipe-categories'
import { formatSource, type RecipeSource } from '@/lib/recipe-source'
import { recipeTimeStats } from '@/lib/recipe-meta'
import { servingsCount } from '@/lib/servings'
import { coverImageSrc } from '@/lib/recipe-image-archive'
import { SEARCH_PATH, categoryPath, profilePath } from '@/lib/routes'
import { authorLinePrefix, parseGenderForm } from '@/lib/gender-form'
import { SourceBadge } from '@/app/components/source-badge'
import { NoPhoto } from '@/app/components/no-photo'
import { RECIPE_SPLIT } from './recipe-split'
import { RecipePhotos } from './recipe-photos'

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
  /** 'f' | 'm' | null from the E01-S23 view column; missing before that migration → neutral. */
  author_gender_form?: string | null
}

interface RecipeHeaderProps {
  recipe: RecipeHeaderData
  /**
   * The gallery photos a signed-in reader can see, under the main photo as thumbnails
   * (handoff 2026-10-28). Empty for a guest, who gets the cover only.
   */
  galleryImages?: string[]
  /** E01-S21: the "Inne przepisy na {danie} (N)" link, under the author line. */
  versionsBar?: ReactNode
  /**
   * The action cards (RecipeActions): a full-width row under the photo and text between
   * lg and xl, under the description in the text column from xl.
   */
  actions?: ReactNode
  /**
   * The list position link and the breadcrumbs (A9): from lg, the first item of the
   * text column, above the title. Hidden below lg, where the header carries the back
   * link and the category line instead.
   */
  listBar?: ReactNode
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
 * The time strip (handoff 2026-10-28): no frame, an icon in a 44 px warm circle beside a
 * label and a 20 px value, in a grid that wraps to fit. At every width — below lg it
 * replaces the time in the "Kategoria · czas" line. Labels are 16 px, not the mock's 14:
 * secondary text is never under 16 px (ZASADY_PROJEKTU).
 */
function TimeStrip({ items }: { items: TimeStripItem[] }) {
  return (
    <ul aria-label="Czas i porcje" className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-x-5 gap-y-4">
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
 * The recipe page header (E01-S07, S07b): the photos (main + thumbnails), 32 px title,
 * the category (below lg), source, who added it, the time strip, and the actions.
 * No breadcrumbs below lg (C3); from lg they sit above the title, in the list bar slot.
 * The tags render at the bottom of the page, in "Ten przepis jest" (E01-S16).
 */
export function RecipeHeader({ recipe, galleryImages = [], versionsBar, actions, listBar }: RecipeHeaderProps) {
  const authorHref = profilePath(recipe.author_username)
  const strip = timeStripItems(recipe)
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
        // The photos (see RecipePhotos): the main photo bleeds like the header photo always
        // did, and the thumbnails sit under it. From lg the photo sits in the ingredients
        // column, so its right edge lines up with „Składniki”.
        <RecipePhotos cover={cover} title={recipe.title} images={galleryImages} badge={sourceBadge} />
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
        {listBar && <div className="hidden print:hidden lg:mb-3 lg:block">{listBar}</div>}
        <h1 className="mb-2 text-[32px] leading-[1.15] font-bold text-ink lg:text-[44px] lg:leading-[1.1]">{recipe.title}</h1>
        {/* The recipe's own short description sits right under the title, not after the
            times row (owner request) — a subtitle qualifying the dish ("ze smalcem"). */}
        {recipe.description && <p className="mb-3 text-scalable-body text-ink-soft">{recipe.description}</p>}
        {/* Below lg (C3): the category. From lg it is in the breadcrumbs. The time moved
            out of this line into the time strip, which shows at every width. */}
        <p className="mb-3 text-[17px] text-ink-soft lg:hidden">{categoryLabel(recipe.category)}</p>

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

        {strip.length > 0 && <TimeStrip items={strip} />}

        {recipe.meta_description && <p className="mt-4 text-scalable-body leading-relaxed text-ink">{recipe.meta_description}</p>}
        {versionsBar && <div className="print:hidden">{versionsBar}</div>}
      </div>
      {actions && <div className="lg:col-span-2 xl:col-span-1 xl:col-start-2">{actions}</div>}
    </header>
  )
}
