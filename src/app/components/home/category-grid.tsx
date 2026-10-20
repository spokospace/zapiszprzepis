import Link from 'next/link'
import { CATEGORY_ICONS, HOME_CATEGORIES, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'

// On the narrowest phones (320px) three columns leave ~70px per tile, which
// splits "Ciasteczka" mid-word at 17px bold, so below 360px the guest grid is two columns.
// Desktop (E01-S17, A8): the guest row is 9 columns, the signed-in grid 4.
const COLUMNS = {
  2: 'grid-cols-2 lg:grid-cols-4',
  3: 'grid-cols-2 min-[360px]:grid-cols-3 lg:grid-cols-9',
} as const

/**
 * Tile looks from the handoff (E01-S20): the guest's A1 tile stacks a 26 px
 * icon over a 17 px name; the signed-in C1 tile is a 56 px row with a
 * `border-accent` frame, the icon beside an 18 px name.
 */
const TILE = {
  2: {
    link: 'h-14 gap-2.5 rounded-field border-[1.5px] border-border-accent bg-surface-accent px-3.5 text-[18px] text-ink hover:border-action-text',
    icon: 'h-6 w-6',
    stroke: 2,
  },
  3: {
    link: 'min-h-[64px] flex-col justify-center gap-1.5 rounded-[12px] bg-surface-accent px-1 py-3.5 text-center text-[17px] text-action-text hover:bg-surface-accent-2',
    icon: 'h-[26px] w-[26px]',
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
export function CategoryGrid({ columns, title = 'Kategorie' }: { columns: keyof typeof COLUMNS; title?: string }) {
  const categories = columns === 3 ? [...HOME_CATEGORIES, GUEST_EXTRA] : HOME_CATEGORIES
  const tile = TILE[columns]
  return (
    <section aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="mb-3 text-[22px] font-bold text-ink">
        {title}
      </h2>
      <ul className={`grid ${COLUMNS[columns]} gap-2`}>
        {categories.map(({ value, label }) => {
          const Icon = CATEGORY_ICONS[value]
          return (
            <li key={value} className={value === GUEST_EXTRA.value ? 'hidden min-w-0 min-[360px]:block' : 'min-w-0'}>
              <Link
                href={categoryPath(value)}
                className={`flex items-center font-bold wrap-anywhere no-underline! ${tile.link}`}
              >
                <Icon aria-hidden="true" strokeWidth={tile.stroke} className={`shrink-0 text-action-text ${tile.icon}`} />
                <span className="min-w-0">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
