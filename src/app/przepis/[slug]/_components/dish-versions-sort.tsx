'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'
import { recipePath } from '@/lib/routes'
import { sourceLabel } from '@/lib/recipe-source'
import { isArchivedImageUrl } from '@/lib/recipe-image-archive'
import { chipClasses } from '@/app/components/ui/chip'
import { CardCarousel } from '@/app/components/card-carousel'
import {
  sortVersions,
  parseVersionsSort,
  versionBadges,
  ingredientDiff,
  type DishVersionRow,
  type VersionsSort,
} from '@/lib/dish-versions'

/** The viewed recipe's fields the diff and the badges compare against. */
export interface CurrentRecipe {
  servings: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
  times_estimated: boolean
  ingredients: unknown
}

const STORAGE_KEY = 'zp.versionsSort'

const OPTIONS: { key: VersionsSort; label: string; announce: string }[] = [
  { key: 'popularne', label: 'Najpopularniejsze', announce: 'najpopularniejsze' },
  { key: 'nowe', label: 'Najnowsze', announce: 'najnowsze' },
  { key: 'szybkie', label: 'Najszybsze', announce: 'najszybsze' },
]

/**
 * The versions list with its sort control (E01-S21). Server-rendered in
 * `initialOrder` (from ?wersje=), so it works without JS — each segment is a
 * real link that reloads with the new order. With JS, a click re-sorts the rows
 * already on the page (no request), updates the URL with replaceState and
 * announces the change; the choice is remembered per viewer in localStorage and
 * applied on mount only when the URL did not pin an order.
 */
export function DishVersionsSort({
  versions,
  initialOrder,
  current,
  label,
}: {
  versions: DishVersionRow[]
  initialOrder: VersionsSort
  current: CurrentRecipe
  /** The section heading, naming the carousel's buttons for screen readers. */
  label: string
}) {
  const [order, setOrder] = useState<VersionsSort>(initialOrder)
  const [announce, setAnnounce] = useState('')

  // The stored choice wins only when the URL pins no order (an explicit
  // ?wersje= beats it). Guarded: a private window simply keeps the default.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('wersje')) return
      const stored = window.localStorage.getItem(STORAGE_KEY)
      // localStorage is unavailable during SSR, so this must apply after mount —
      // a lazy initializer would mismatch the server HTML. The re-sort is below
      // the fold, so there is no visible jump.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setOrder(parseVersionsSort(stored))
    } catch {
      // storage blocked — keep the server order
    }
  }, [])

  const rows = useMemo(() => sortVersions(versions, order), [versions, order])

  function pick(event: React.MouseEvent, key: VersionsSort) {
    event.preventDefault()
    setOrder(key)
    setAnnounce(`Kolejność: ${OPTIONS.find((o) => o.key === key)?.announce ?? ''}`)
    try {
      window.localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // ignore
    }
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('wersje', key)
      url.hash = 'inne-przepisy'
      window.history.replaceState(null, '', url)
    } catch {
      // ignore
    }
  }

  return (
    <>
      {versions.length >= 2 && (
        <div role="group" aria-labelledby="wersje-kolejnosc" className="mb-5 flex flex-wrap items-center gap-2">
          <span id="wersje-kolejnosc" className="mr-1 text-[16px] font-bold text-ink-soft">
            Kolejność:
          </span>
          {OPTIONS.map(({ key, label }) => {
            const active = order === key
            return (
              <a
                key={key}
                href={`?wersje=${key}#inne-przepisy`}
                aria-current={active ? 'true' : undefined}
                onClick={(e) => pick(e, key)}
                className={chipClasses(active)}
              >
                {active ? '✓ ' : ''}
                {label}
              </a>
            )
          })}
        </div>
      )}

      {/* A swipeable strip with buttons on a phone; one card a row from sm, two from lg.
          Keyed by the order, so a re-sort starts the strip again at its first card. */}
      <CardCarousel
        key={order}
        label={label}
        layout="rows"
        items={rows.map((v) => ({ key: v.id, card: <VersionCard version={v} current={current} /> }))}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </>
  )
}

function VersionCard({ version: v, current }: { version: DishVersionRow; current: CurrentRecipe }) {
  const heading = v.variant_note ?? v.title
  const badges = versionBadges(current, v)
  const diff = ingredientDiff(current.ingredients, v.ingredients)
  const badgeLabels = [badges.servings, badges.time].filter((b): b is string => Boolean(b))

  return (
    // On a phone (a carousel card) the photo spans the card above the text; from sm a 72 px thumbnail beside it.
    <article className="relative flex h-full flex-col gap-3 rounded-2xl border-2 border-border-card p-4 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus sm:flex-row sm:gap-4">
      <div className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-accent-2 sm:aspect-auto sm:h-[72px] sm:w-[72px]">
        {v.image_url ? (
          <Image
            src={v.image_url}
            alt=""
            fill
            // 3/4 of the strip less the card's padding and frame; the thumbnail from 40rem.
            sizes="(min-width: 40rem) 72px, calc(75vw - 3.5rem)"
            className="object-cover"
            unoptimized={!isArchivedImageUrl(v.image_url)}
          />
        ) : (
          // The RPC returns no category (a version may sit in another one), so a neutral icon.
          <UtensilsCrossed aria-hidden="true" strokeWidth={1.5} className="h-12 w-12 text-action-text sm:h-8 sm:w-8" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-[19px] font-bold leading-snug text-ink">
          <Link href={recipePath(v.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {heading}
            {v.variant_note && <span className="sr-only"> — {v.title}</span>}
          </Link>
        </h3>
        {v.variant_note && <p className="text-[16px] break-words text-ink-soft">{v.title}</p>}
        <p className="text-[16px] break-words text-ink-soft">{sourceLabel(v.source_type, v.source_url, v.source_author)}</p>

        {badgeLabels.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-2">
            {badgeLabels.map((label) => (
              <li key={label} className="inline-flex rounded-pill bg-surface-3 px-3 py-1 text-[16px] text-ink">
                {label}
              </li>
            ))}
          </ul>
        )}

        {diff.plus.length > 0 && (
          <p className="mt-1 text-[16px] break-words text-[#15803d]">
            <span className="sr-only">Składniki, których nie ma w oglądanym przepisie: </span>
            <b>+ jest:</b> {diff.plus.join(', ')}
          </p>
        )}
        {diff.minus.length > 0 && (
          <p className="text-[16px] break-words text-danger">
            <span className="sr-only">Składniki z oglądanego przepisu, których nie ma w tej wersji: </span>
            <b>− nie ma:</b> {diff.minus.join(', ')}
          </p>
        )}

        <span aria-hidden="true" className="mt-1 text-[16px] font-bold text-action-text underline underline-offset-2">
          Otwórz ten przepis →
        </span>
      </div>
    </article>
  )
}
