import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import {
  versionsHeading,
  versionTimeCompare,
  ingredientDiff,
  type DishVersionRow,
  type VersionsSort,
} from '@/lib/dish-versions'
import { formatSource } from '@/lib/recipe-source'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { recipePath } from '@/lib/routes'
import { FavoriteButton } from '@/app/components/favorite-button'
import { NoPhoto } from '@/app/components/no-photo'
import { DishVersionsSort } from './dish-versions-sort'

/** The viewed recipe's fields the diff and the time comparison compare against. */
export interface CurrentRecipe {
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  times_estimated: boolean
  ingredients: unknown
}

interface DishVersionsProps {
  versions: DishVersionRow[]
  /** The full N for the heading (count over all siblings, even past the 24 fetched). */
  totalCount: number
  /** The dish name (nominative, as stored); the heading takes its genitive from it. */
  dish: string | null
  /** The signed-in viewer's favorites among these versions; null for a guest (the heart sends them to log in). */
  favoriteIds: ReadonlySet<number> | null
  /** The server-resolved order (from ?wersje=); the client island may re-sort after hydration. */
  order: VersionsSort
  /** The recipe being viewed, for the ingredient diff and the time comparison. */
  current: CurrentRecipe
}

// The difference chips (handoff 2026-10-28 §6). Colour, the "+" and the strike-through all
// carry the meaning, and a hidden prefix says it to a screen reader, so colour is never the
// only carrier (WCAG 1.4.1). Both pairs are well over 4.5:1. 16 px, not the mock's 15:
// secondary text is never under 16 px (ZASADY_PROJEKTU).
const CHIP = 'rounded-md px-2 py-0.5 text-[16px] font-bold'
const CHIP_PLUS = `${CHIP} bg-[#dcfce7] text-[#14532d]`
const CHIP_MINUS = `${CHIP} bg-[#fee2e2] text-[#7f1d1d] line-through`

function DiffChips({ plus, minus }: { plus: string[]; minus: string[] }) {
  if (plus.length === 0 && minus.length === 0) return null
  return (
    <ul aria-label="Różnice w składnikach" className="mt-2 flex flex-wrap gap-1.5">
      {plus.map((name) => (
        <li key={`plus-${name}`} className={CHIP_PLUS}>
          <span className="sr-only">ma dodatkowo: </span>
          <span aria-hidden="true">+ </span>
          {name}
        </li>
      ))}
      {minus.map((name) => (
        <li key={`minus-${name}`} className={CHIP_MINUS}>
          <span className="sr-only">nie ma: </span>
          {name}
        </li>
      ))}
    </ul>
  )
}

/** The legend over the list: what a green "+" chip and a struck red chip mean. */
function Legend() {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[16px] text-ink-soft">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={CHIP_PLUS}>
          + składnik
        </span>
        ma dodatkowo
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={CHIP_MINUS}>
          składnik
        </span>
        nie ma
      </span>
    </p>
  )
}

/**
 * One version as a comparison row (handoff 2026-10-28 §6; owner decision 2026-10-29 for the
 * list over the shared card): a 132 px 4:3 photo, the title (a link), "podpis · źródło",
 * the difference chips, then the time with how much longer or shorter it takes, and the
 * heart. From lg the four sit in one row; below lg they stack, the time and heart last.
 */
function VersionRow({
  version: v,
  current,
  favoriteIds,
}: {
  version: DishVersionRow
  current: CurrentRecipe
  favoriteIds: ReadonlySet<number> | null
}): ReactNode {
  const diff = ingredientDiff(current.ingredients, v.ingredients)
  const time = versionTimeCompare(current, v)
  const source = formatSource(v.source_type, v.source_url, v.source_author)
  const meta = [v.variant_note, source.text].filter(Boolean).join(' · ')

  return (
    <div className="border-t border-border-card py-5 lg:grid lg:grid-cols-[132px_minmax(0,1fr)_auto_48px] lg:items-start lg:gap-x-5">
      <div className="relative aspect-[4/3] w-[132px] overflow-hidden bg-surface-3">
        {v.image_url ? (
          <Image
            src={v.image_url}
            // The title next to it names the row; the photo is decorative.
            alt=""
            fill
            sizes="132px"
            className="object-cover"
            unoptimized={!isArchivedImageUrl(v.image_url)}
          />
        ) : (
          <NoPhoto category="" iconClassName="h-8 w-8" />
        )}
      </div>
      <div className="mt-3 min-w-0 lg:mt-0">
        <h3 className="text-[20px] leading-tight font-extrabold text-ink">
          <Link href={recipePath(v.slug)} className="underline wrap-anywhere hover:text-action-hover">
            {v.title}
          </Link>
        </h3>
        {meta && <p className="mt-1 text-[16px] text-ink-soft wrap-anywhere">{meta}</p>}
        <DiffChips plus={diff.plus} minus={diff.minus} />
      </div>
      {/* Below lg: the time and the heart share a right-aligned row. From lg `contents`
          lets both join the row's grid as its last two columns. */}
      <div className="mt-3 flex items-center justify-end gap-4 lg:contents">
        {time.value ? (
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-[18px] font-extrabold text-ink">
              <Clock aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
              {time.value}
            </p>
            {time.delta && <p className="text-[16px] text-ink-soft">{time.delta}</p>}
          </div>
        ) : (
          <span aria-hidden="true" />
        )}
        <FavoriteButton
          recipeId={v.id}
          initialFavorited={favoriteIds?.has(v.id) ?? false}
          isAuthenticated={favoriteIds !== null}
          size="photo"
          recipeTitle={v.title}
        />
      </div>
    </div>
  )
}

/** "Inne wersje pączków (5)" → ["Inne wersje pączków", "5"], so the count can take the accent. */
export function splitHeadingCount(heading: string): [text: string, count: string | null] {
  const match = /^(.*) \((\d+)\)$/.exec(heading)
  return match ? [match[1], match[2]] : [heading, null]
}

/**
 * "Inne wersje {dania} (N)" (E01-S21; handoff 2026-10-28 §6), before the tags and
 * "Podobne". The heading is the anchor target of the versions box; it takes focus so
 * keyboard / screen-reader users land here, and its scroll margin clears the sticky app
 * header. The rows are rendered here (server) and handed to the client sort island, which
 * only re-orders them and opens the rest of the list; without JS the sort links reload
 * with ?wersje= and every row shows.
 */
export function DishVersions({ versions, totalCount, dish, favoriteIds, order, current }: DishVersionsProps) {
  if (versions.length === 0) return null
  const heading = versionsHeading(totalCount, dish)
  const [headingText, count] = splitHeadingCount(heading)
  const rows: Record<number, ReactNode> = Object.fromEntries(
    versions.map((v) => [v.id, <VersionRow key={v.id} version={v} current={current} favoriteIds={favoriteIds} />]),
  )
  return (
    <section aria-labelledby="inne-przepisy" className="mb-12 border-t border-border-card pt-8">
      <DishVersionsSort
        versions={versions}
        initialOrder={order}
        rows={rows}
        header={
          <div className="min-w-0">
            <h2
              id="inne-przepisy"
              tabIndex={-1}
              className="mb-1 scroll-mt-36 text-[26px] leading-tight font-extrabold text-ink focus:outline-none lg:scroll-mt-40 lg:text-[30px]"
            >
              {headingText}
              {count && (
                <>
                  {' '}
                  <span className="text-action-text">({count})</span>
                </>
              )}
            </h2>
            <p className="text-[17px] text-ink-soft">Porównane z tym przepisem: co dochodzi, czego brakuje i ile dłużej trwa.</p>
          </div>
        }
        legend={<Legend />}
      />
    </section>
  )
}
