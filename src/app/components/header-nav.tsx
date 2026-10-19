'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { SEARCH_PATH, categoryPath } from '@/lib/routes'

const NAV_ITEM =
  'inline-flex min-h-[48px] items-center gap-1 rounded-field px-3 text-[18px] font-semibold text-ink no-underline! hover:bg-surface-3'

/**
 * The guest desktop header's "Przepisy" + "Kategorie ▾" (E01-S17, A8).
 * "Kategorie" is a disclosure: a button with aria-expanded that shows every
 * category; Escape, a click outside or focus leaving it closes it (Escape
 * returns focus to the button), and so does navigating. Without JS the same categories stay
 * reachable from the home grid.
 */
export function HeaderNav({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // A navigation (a category picked, back/forward) never leaves the panel open.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <nav aria-label="Przepisy" className={`items-center gap-1 ${className}`}>
      <Link href={SEARCH_PATH} className={NAV_ITEM}>
        Przepisy
      </Link>
      <div
        ref={rootRef}
        className="relative"
        // Tabbing past the last category (or back before the button) closes the panel.
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls="header-categories"
          onClick={() => setOpen((o) => !o)}
          className={NAV_ITEM}
        >
          Kategorie
          <ChevronDown aria-hidden="true" className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <ul
          id="header-categories"
          hidden={!open}
          className="absolute left-0 top-full z-30 mt-2 grid w-[420px] grid-cols-2 gap-1 rounded-card border border-border-card-2 bg-white p-2 shadow-lg"
        >
          {RECIPE_CATEGORIES.map(({ value, label }) => (
            <li key={value}>
              <Link
                href={categoryPath(value)}
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center rounded-field px-3 text-[18px] font-semibold text-ink no-underline! hover:bg-surface-3"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
