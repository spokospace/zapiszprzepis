import Link from 'next/link'
import { HOME_CATEGORIES, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'

// On the narrowest phones (320px) three columns leave ~70px per tile, which
// splits "Ciasteczka" mid-word at 17px bold, so below 360px the guest grid is two columns.
// Desktop (E01-S17, A8): the guest row is 9 columns, the signed-in grid 4.
const COLUMNS = {
  2: 'grid-cols-2 lg:grid-cols-4',
  3: 'grid-cols-2 min-[360px]:grid-cols-3 lg:grid-cols-9',
} as const

/** The guest's 9-column desktop row shows one category beyond the home eight, from lg only. */
const DESKTOP_EXTRA = RECIPE_CATEGORIES[HOME_CATEGORIES.length]

/** "Kategorie" tiles (E01-S04): 3 columns for a guest (from 360px), 2 for a signed-in user. */
export function CategoryGrid({ columns }: { columns: keyof typeof COLUMNS }) {
  const categories = columns === 3 ? [...HOME_CATEGORIES, DESKTOP_EXTRA] : HOME_CATEGORIES
  return (
    <section aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="mb-3 text-[22px] font-bold text-ink">
        Kategorie
      </h2>
      <ul className={`grid ${COLUMNS[columns]} gap-2.5`}>
        {categories.map(({ value, label }) => (
          <li key={value} className={value === DESKTOP_EXTRA.value ? 'hidden min-w-0 lg:block' : 'min-w-0'}>
            <Link
              href={categoryPath(value)}
              className="flex min-h-[64px] items-center justify-center rounded-card border-2 border-border-card bg-white p-2 text-center text-[17px] lg:px-1 font-bold break-words text-ink hover:border-border-card-2 hover:bg-surface-2"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
