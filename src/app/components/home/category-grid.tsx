import Link from 'next/link'
import { HOME_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'

const COLUMNS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
} as const

/** "Kategorie" tiles (E01-S04): 3 columns for a guest, 2 for a signed-in user. */
export function CategoryGrid({ columns }: { columns: keyof typeof COLUMNS }) {
  return (
    <section aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="mb-3 text-[22px] font-bold text-ink">
        Kategorie
      </h2>
      <ul className={`grid ${COLUMNS[columns]} gap-2.5`}>
        {HOME_CATEGORIES.map(({ value, label }) => (
          <li key={value} className="min-w-0">
            <Link
              href={categoryPath(value)}
              className="flex min-h-[64px] items-center justify-center rounded-card border-2 border-border-card bg-white p-2 text-center text-[17px] font-bold break-words text-ink hover:border-border-card-2 hover:bg-surface-2"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
