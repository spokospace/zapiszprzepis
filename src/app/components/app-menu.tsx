'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Heart, Lock, LogOut, Menu, Plus, Settings, X, type LucideIcon } from 'lucide-react'
import { signOut } from '@/app/(actions)/sign-out'
import { buttonClasses } from '@/app/components/ui/button'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'
import type { MenuSummary } from '@/lib/menu-summary'
import { buildMenuModel, recipesNoun, type MineEntry, type MineEntryKey } from './app-menu-model'

const MINE_ICONS: Record<MineEntryKey, LucideIcon> = {
  'my-recipes': BookOpen,
  favorites: Heart,
  add: Plus,
}

const LABELED_ICON_BUTTON =
  'inline-flex min-h-[48px] items-center gap-1.5 rounded-field px-3 text-[17px] font-semibold text-ink hover:bg-surface-3'

const SECTION_HEADING = 'px-5 pb-2 text-[17px] font-bold text-ink-soft'

/** Active route: colour plus a left bar, never colour alone. */
function activeClasses(active: boolean): string {
  return active ? 'text-action-text border-l-4 border-action' : 'text-ink border-l-4 border-transparent'
}

function MineRow({ entry, active, onNavigate }: { entry: MineEntry; active: boolean; onNavigate: () => void }) {
  const Icon = entry.locked ? Lock : MINE_ICONS[entry.key]
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      // Only the label is underlined: the global (unlayered) `a` underline would
      // otherwise run through the counter pill and the lock caption, and only an
      // !important utility outranks it.
      className={`flex min-h-[56px] items-center gap-3 px-5 py-3 text-[19px] font-semibold no-underline! hover:bg-surface-2 ${activeClasses(active)}`}
    >
      <Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
      <span className="flex flex-col">
        <span className="underline underline-offset-4">{entry.label}</span>
        {entry.locked && (
          <span className="text-[16px] font-normal text-ink-soft">Wymaga kodu lub pełnego dostępu</span>
        )}
      </span>
      {entry.count !== null && (
        <>
          <span
            aria-hidden="true"
            className="ml-auto min-w-[2.25rem] rounded-pill bg-surface-3 px-2.5 py-0.5 text-center text-[17px] font-bold text-ink"
          >
            {entry.count}
          </span>
          <span className="sr-only">
            , {entry.count} {recipesNoun(entry.count)}
          </span>
        </>
      )}
    </Link>
  )
}

/**
 * Header "MENU" button + drawer (E01-S09): "Moje" (or the guest's sign-in
 * CTA), every category, and the "Ustawienia | Wyloguj" footer. Full screen on
 * phones, a 330px right-side panel from `sm` up. Built on a native `<dialog>`
 * opened with `showModal()`, which gives Escape to close, a focus trap, focus
 * return to the MENU button and an inert page behind it without extra code.
 */
export function AppMenu({
  isAuthenticated,
  summary,
}: {
  isAuthenticated: boolean
  /** Counters + full access; undefined where the page did not load it. */
  summary?: MenuSummary | null
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  const { mine, showAccountFooter } = buildMenuModel({ isAuthenticated, summary })

  function close() {
    dialogRef.current?.close()
  }

  // A navigation (including back/forward) should never leave the drawer open.
  useEffect(() => {
    dialogRef.current?.close()
  }, [pathname])

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        aria-controls="app-menu"
        // 48px target (WCAG 2.5.8 / project rule), tokens instead of raw greys.
        className="inline-flex min-h-[48px] items-center gap-1.5 rounded-field px-2.5 text-sm font-semibold text-ink hover:bg-surface-3"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        MENU
      </button>

      <dialog
        id="app-menu"
        ref={dialogRef}
        aria-labelledby="app-menu-title"
        // A click on the backdrop lands on the <dialog> element itself; clicks
        // inside the panel land on its children.
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink shadow-xl transition-transform duration-200 ease-out backdrop:bg-black/40 starting:open:translate-x-full sm:w-[330px]"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border-card px-5 py-3">
            <h2 id="app-menu-title" className="text-[21px] font-bold text-ink">
              Menu
            </h2>
            <button type="button" onClick={close} className={LABELED_ICON_BUTTON}>
              <X aria-hidden="true" className="h-6 w-6" />
              Zamknij
            </button>
          </div>

          <nav aria-label="Menu główne" className="flex-1 overflow-x-hidden overflow-y-auto py-4">
            {mine ? (
              <section aria-labelledby="app-menu-mine" className="pb-4">
                <h3 id="app-menu-mine" className={SECTION_HEADING}>
                  Moje
                </h3>
                <ul>
                  {mine.map((entry) => (
                    <li key={entry.key}>
                      <MineRow
                        entry={entry}
                        // A locked "Dodaj" points at the gate on "/", not at itself: never mark it current.
                        active={!entry.locked && pathname === entry.href}
                        onNavigate={close}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section aria-label="Konto" className="px-5 pb-6">
                <p className="mb-3 text-[17px] text-ink-soft">Zaloguj się, żeby zapisywać ulubione przepisy.</p>
                <div className="flex flex-col gap-3">
                  <Link href="/login" onClick={close} className={`${buttonClasses('primary', 'lg')} w-full`}>
                    Zaloguj się
                  </Link>
                  <Link href="/signup" onClick={close} className={`${buttonClasses('outline', 'lg')} w-full`}>
                    Załóż konto
                  </Link>
                </div>
              </section>
            )}

            <section aria-labelledby="app-menu-categories" className="border-t border-border-card pt-4">
              <h3 id="app-menu-categories" className={SECTION_HEADING}>
                Wszystkie przepisy według kategorii
              </h3>
              <ul className="grid grid-cols-2 gap-2 px-5">
                {RECIPE_CATEGORIES.map(({ value, label }) => {
                  const href = categoryPath(value)
                  const active = pathname === href
                  return (
                    <li key={value}>
                      <Link
                        href={href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'flex h-full min-h-[56px] items-center rounded-field border-2 px-3 py-2 text-[17px] font-semibold break-words hover:bg-surface-2',
                          active ? 'border-action bg-surface-accent text-action-text' : 'border-field text-ink',
                        ].join(' ')}
                      >
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          </nav>

          {showAccountFooter && (
            <div className="grid grid-cols-2 divide-x divide-border-card border-t border-border-card">
              <Link
                href="/settings"
                onClick={close}
                aria-current={pathname === '/settings' ? 'page' : undefined}
                className={`flex min-h-[56px] items-center justify-center gap-2 text-[17px] font-semibold hover:bg-surface-2 ${pathname === '/settings' ? 'text-action-text underline decoration-2 underline-offset-4' : 'text-ink'}`}
              >
                <Settings aria-hidden="true" className="h-6 w-6 shrink-0" />
                Ustawienia
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex min-h-[56px] w-full items-center justify-center gap-2 text-[17px] font-semibold text-ink hover:bg-surface-2"
                >
                  <LogOut aria-hidden="true" className="h-6 w-6 shrink-0" />
                  Wyloguj
                </button>
              </form>
            </div>
          )}
        </div>
      </dialog>
    </>
  )
}
