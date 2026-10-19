'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { chipClasses } from '@/app/components/ui/chip'
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
export function TagFilter({ chips, question }: { chips: TagChip[]; /** "Jakie ciasteczka?" (screen 6). */ question: string }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const hidden = chips.length - VISIBLE_CHIPS
  const shown = expanded ? chips : chips.slice(0, VISIBLE_CHIPS)

  return (
    <nav aria-labelledby={`${listId}-h`}>
      <h2 id={`${listId}-h`} className="text-[19px] font-bold text-ink">
        {question}
      </h2>
      <p className="mb-3 text-[16px] leading-snug text-ink-soft">
        Możesz zaznaczyć kilka. Pokażemy przepisy, które pasują do wszystkich.
      </p>
      <ul id={listId} className="flex flex-wrap gap-2">
        {shown.map((chip) => (
          <li key={chip.value}>
            <Link href={chip.href} scroll={false} className={chipClasses(chip.selected)}>
              {/* Name reads "kruche 12 przepisów, wybrany": the visible "kruche 12" stays
                  one contiguous run (WCAG 2.5.3), the explicit spaces keep the two
                  flex items from merging into "kruche12". */}
              <span>
                {chip.selected && <span aria-hidden="true">✓ </span>}
                {chip.label}{' '}
              </span>
              <span className="text-[16px] font-normal opacity-80">
                {chip.count}
                <span className="sr-only">
                  {' '}
                  {recipesNoun(chip.count)}
                  {chip.selected && ', wybrany'}
                </span>
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
              // Screen 6: a plain underlined text action under the chips, not another chip-like box.
              className="inline-flex min-h-[48px] items-center px-1 text-[17px] font-bold text-ink underline underline-offset-4 hover:text-action-hover"
            >
              {expanded ? 'Pokaż mniej' : `Pokaż wszystkie (${chips.length})`}
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
