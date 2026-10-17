'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { chipClasses } from '@/app/components/ui/chip'

export interface CategoryOption {
  /** null = "Wszystkie". */
  value: string | null
  label: string
  count: number
  /** This search narrowed to the option (a plain link: works before hydration, shareable). */
  href: string
}

interface SearchCategoryFilterProps {
  /** "Wszystkie" first, then the categories among the matches; empty = no button. */
  options: CategoryOption[]
  /** The category in effect, null for none. */
  selected: string | null
  /** The "N przepisów dla „q”" line the button sits beside. */
  children: ReactNode
}

/**
 * The count row of /szukaj with the "Kategoria" filter button beside it (C2,
 * E01-S22). The button opens the categories among the matches as chips under
 * the row; picking one is a new search from page 1.
 */
export function SearchCategoryFilter({ options, selected, children }: SearchCategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const active = options.find((o) => o.value !== null && o.value === selected)
  if (options.length === 0) return children

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {children}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-[12px] border-2 border-field bg-white px-3 text-[16px] font-bold text-ink hover:bg-surface-3"
        >
          <SlidersHorizontal aria-hidden="true" className="h-5 w-5 shrink-0" />
          {active ? `Kategoria: ${active.label}` : 'Kategoria'}
        </button>
      </div>
      {open && (
        <nav id={panelId} aria-label="Kategoria wyników">
          <ul className="flex flex-wrap gap-2">
            {options.map((o) => {
              const current = o.value === selected
              return (
                <li key={o.value ?? 'all'}>
                  <Link href={o.href} aria-current={current ? 'page' : undefined} className={chipClasses(current)}>
                    <span>
                      {current && <span aria-hidden="true">✓ </span>}
                      {o.label}{' '}
                    </span>
                    <span className="text-[16px] font-normal opacity-80">{o.count}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
