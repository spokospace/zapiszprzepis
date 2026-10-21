import Link from 'next/link'
import { categoryDisplayLabel, CATEGORY_ICONS, HOME_CATEGORIES, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'

// Names never break mid-word: `break-words` breaks only as a last resort and
// `categoryDisplayLabel` binds Polish one-letter words. Tiles are sized to fit the
// longest name ("Ciasteczka") at 16px — the guest grid drops to 2 columns below 360px
// and the signed-in grid to 1. Desktop (E01-S17, A8): the guest row is 9 columns, the
// signed-in grid 4.
const COLUMNS = {
  2: 'grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4',
  3: 'grid-cols-2 min-[360px]:grid-cols-3 lg:grid-cols-9',
} as const

/**
 * Tile looks from the handoff (E01-S20): the guest's A1 tile stacks a 26 px
 * icon over a 16 px name; the signed-in C1 tile is a 56 px row with a
 * `border-accent` frame, the icon beside a 16 px name.
 */
const TILE = {
  2: {
    link: 'h-14 gap-1.5 rounded-tile border border-ink bg-white px-2 text-[16px] text-ink hover:bg-surface-2',
    icon: 'h-5 w-5',
    stroke: 2,
  },
  3: {
    link: 'min-h-[76px] flex-col justify-center gap-1.5 rounded-tile border border-ink bg-white px-1 py-3 text-center text-[16px] text-ink hover:bg-surface-2',
    icon: 'h-6 w-6',
    stroke: 1.75,
  },
} as const

/**
 * The guest grid shows one category beyond the home eight wherever it has three
 * columns (A1's 3×3, A8's 9-column row); the 2-column grid below 360px keeps eight.
 */
const GUEST_EXTRA = RECIPE_CATEGORIES[HOME_CATEGORIES.length]

/**
 * "Kategorie" tiles (E01-S04): 3 columns for a guest (from 360px), 2 for a signed-in
 * user. The empty search screen titles them „Albo wybierz kategorię” (4a, E01-S26).
 */
export function CategoryGrid({
  columns,
  title = 'Kategorie',
  className = '',
}: {
  columns: keyof typeof COLUMNS
  title?: string
  className?: string
}) {
  const categories = columns === 3 ? [...HOME_CATEGORIES, GUEST_EXTRA] : HOME_CATEGORIES
  const tile = TILE[columns]
  return (
    <section aria-labelledby="categories-heading" className={className}>
      <h2 id="categories-heading" className="mb-3 border-t border-ink pt-5 text-[26px] font-bold text-ink">
        {title}
      </h2>
      <ul className={`grid ${COLUMNS[columns]} gap-2.5`}>
        {categories.map(({ value, label }) => {
          const Icon = CATEGORY_ICONS[value]
          return (
            <li key={value} className={value === GUEST_EXTRA.value ? 'hidden min-w-0 min-[360px]:block' : 'min-w-0'}>
              <Link
                href={categoryPath(value)}
                className={`flex items-center font-bold break-words no-underline! ${tile.link}`}
              >
                <Icon aria-hidden="true" strokeWidth={tile.stroke} className={`shrink-0 text-action-text ${tile.icon}`} />
                {/* max-w-full: in the centred 3-column tile the name is as wide as its
                    longest word, so at a large system font break-words never got to act (#448). */}
                <span className="min-w-0 max-w-full">{categoryDisplayLabel(label)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
