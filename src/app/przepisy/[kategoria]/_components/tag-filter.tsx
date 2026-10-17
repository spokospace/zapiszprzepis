'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { chipClasses } from '@/app/components/ui/chip'
import { buttonClasses } from '@/app/components/ui/button'
import { recipesNoun } from '@/app/components/app-menu-model'

export interface TagChip {
  value: string
  label: string
  count: number
  selected: boolean
  /** The category URL with this tag toggled. */
  href: string
}

/** Chips shown before "Pokaż wszystkie (N)". Selected chips sort first, so they are always visible. */
export const VISIBLE_CHIPS = 8

/**
 * The tag chips of the public category page (E01-S16). Each chip is a link that
 * toggles its tag in `?tag=`, so the filter works before hydration and is
 * shareable; this component only adds the "Pokaż wszystkie" toggle.
 */
export function TagFilter({ chips }: { chips: TagChip[] }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const hidden = chips.length - VISIBLE_CHIPS
  const shown = expanded ? chips : chips.slice(0, VISIBLE_CHIPS)

  return (
    <nav aria-labelledby={`${listId}-h`} className="mb-4">
      <h2 id={`${listId}-h`} className="mb-3 text-[18px] font-bold text-ink">
        Tagi
      </h2>
      <ul id={listId} className="flex flex-wrap gap-2">
        {shown.map((chip) => (
          <li key={chip.value}>
            <Link href={chip.href} scroll={false} className={chipClasses(chip.selected)}>
              <span>
                {chip.selected && <span aria-hidden="true">✓ </span>}
                {chip.label}
                {chip.selected && <span className="sr-only">, wybrany</span>}
              </span>
              <span className="text-[16px] font-normal opacity-80">
                {chip.count}
                <span className="sr-only"> {recipesNoun(chip.count)}</span>
              </span>
            </Link>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded((v) => !v)}
              className={buttonClasses('outline', 'md')}
            >
              {expanded ? 'Pokaż mniej' : `Pokaż wszystkie (${chips.length})`}
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
