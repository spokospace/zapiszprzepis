'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Heart, Lock, LogOut, Menu, Plus, Settings, X, type LucideIcon } from 'lucide-react'
import { signOut } from '@/app/(actions)/sign-out'
import { buttonClasses } from '@/app/components/ui/button'
import { CATEGORY_ICONS, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'
import type { MenuSummary } from '@/lib/menu-summary'
import { buildMenuModel, recipesNoun, type MineEntry, type MineEntryKey } from './app-menu-model'

const MINE_ICONS: Record<MineEntryKey, LucideIcon> = {
  'my-recipes': BookOpen,
  favorites: Heart,
  add: Plus,
}

// "× Zamknij": 56 px, 18 px bold (handoff C5).
const LABELED_ICON_BUTTON =
  'inline-flex min-h-14 items-center gap-1.5 rounded-field px-3 text-[18px] font-bold text-ink hover:bg-surface-3'

// "Ustawienia | Wyloguj": 64 px rows, 18 px bold (handoff C5).
const FOOTER_ROW = 'flex min-h-16 items-center justify-center gap-2 text-[18px] font-bold hover:bg-surface-2'

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
      <span className="flex min-w-0 flex-col">
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
        // Mobile 1c (E01-S19): icon over a 13 px bold caption, 60x56 like Dodaj and
        // Powiadomienia. The desktop header (E01-S17) keeps the 48 px inline row.
        className="inline-flex h-14 w-[60px] flex-col items-center justify-center gap-0.5 rounded-field text-[13px] leading-none font-bold text-ink hover:bg-surface-3 lg:h-auto lg:min-h-[48px] lg:w-auto lg:flex-row lg:gap-1.5 lg:px-2.5 lg:text-sm lg:leading-5 lg:font-semibold"
      >
        <Menu aria-hidden="true" className="h-6 w-6 lg:h-5 lg:w-5" />
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
          <div className="flex items-center justify-between border-b-2 border-border-card py-1 pr-2 pl-5">
            <h2 id="app-menu-title" className="text-[22px] font-bold text-ink">
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
                        // A locked "Dodaj" opens the 3c gate on /dodaj, not the add form: never mark it current.
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

            <section aria-labelledby="app-menu-categories" className="border-t-2 border-border-card pt-4">
              <h3 id="app-menu-categories" className={SECTION_HEADING}>
                Wszystkie przepisy według kategorii
              </h3>
              <ul className="grid grid-cols-2 gap-2 px-5">
                {RECIPE_CATEGORIES.map(({ value, label }) => {
                  const href = categoryPath(value)
                  const active = pathname === href
                  const Icon = CATEGORY_ICONS[value]
                  return (
                    <li key={value}>
                      <Link
                        href={href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        // C5: the home C1 tile (E01-S20) — #fff7ed, a 1.5 px #fed7aa frame,
                        // the category icon beside an 18 px bold name.
                        className={[
                          'flex h-full min-h-[56px] items-center gap-2.5 rounded-field border-[1.5px] bg-surface-accent px-3.5 py-2 text-[18px] font-bold wrap-anywhere no-underline! hover:border-action-text',
                          active ? 'border-action text-action-text' : 'border-border-accent text-ink',
                        ].join(' ')}
                      >
                        <Icon aria-hidden="true" strokeWidth={2} className="h-6 w-6 shrink-0 text-action-text" />
                        <span className="min-w-0">{label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          </nav>

          {showAccountFooter && (
            <div className="grid grid-cols-2 divide-x-2 divide-border-card border-t-2 border-border-card">
              <Link
                href="/settings"
                onClick={close}
                aria-current={pathname === '/settings' ? 'page' : undefined}
                className={`${FOOTER_ROW} ${pathname === '/settings' ? 'text-action-text underline decoration-2 underline-offset-4' : 'text-ink'}`}
              >
                <Settings aria-hidden="true" className="h-6 w-6 shrink-0" />
                Ustawienia
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className={`${FOOTER_ROW} w-full text-ink`}
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
