'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RECIPE_CATEGORIES, CATEGORY_ICONS, categoryDisplayLabel } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'

/**
 * The desktop category bar (ZMIANY_prototyp §2, row 2): one horizontal row of every
 * category, scrolled sideways rather than wrapped, so the primary navigation stays
 * one line and always visible (older users read a visible bar more reliably than a
 * hidden menu). „Więcej ›” / „‹ Wstecz” buttons sit under a white gradient at each
 * end and appear only when there is more to scroll. Desktop only — below lg the
 * categories live in MENU and the home tiles. Pure chrome; it changes no logic.
 */
export function CategoryBar({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  // Decoded once; categoryPath values are compared against it per link below.
  const decodedPath = decodeURIComponent(pathname)
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    // 2 px slack so a sub-pixel scrollWidth never leaves a button stuck on.
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    update()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  function scrollByPage(direction: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * (el.clientWidth - 160), behavior: 'smooth' })
  }

  return (
    <nav aria-label="Kategorie" className={`relative ${className}`}>
      {/* gap-x-5 = 20px; pr-40 = room on the right so the last category clears the
          „Więcej” button (the container's own padding supplies the left inset). */}
      <ul
        ref={scrollerRef}
        className="flex items-center gap-x-5 overflow-x-auto py-1 pr-40 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {RECIPE_CATEGORIES.map(({ value, label }) => {
          const href = categoryPath(value)
          const active = decodedPath === href.split('?')[0]
          const Icon = CATEGORY_ICONS[value]
          return (
            <li key={value}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-12 items-center gap-1.5 whitespace-nowrap text-[16px] font-bold text-ink no-underline! hover:text-action-text hover:underline ${
                  active ? 'underline decoration-2 underline-offset-4' : ''
                }`}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-action-text" />
                {categoryDisplayLabel(label)}
              </Link>
            </li>
          )
        })}
      </ul>

      {canLeft && (
        <button
          type="button"
          aria-label="Przewiń kategorie wstecz"
          onClick={() => scrollByPage(-1)}
          className="absolute top-0 bottom-0 left-0 flex items-center pr-16 pl-5 text-[16px] font-bold text-ink"
          style={{ background: 'linear-gradient(90deg, #fff 0, #fff calc(100% - 56px), transparent)' }}
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          Wstecz
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Przewiń kategorie dalej"
          onClick={() => scrollByPage(1)}
          className="absolute top-0 right-0 bottom-0 flex items-center pr-5 pl-16 text-[16px] font-bold text-ink"
          style={{ background: 'linear-gradient(270deg, #fff 0, #fff calc(100% - 56px), transparent)' }}
        >
          Więcej
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </nav>
  )
}
