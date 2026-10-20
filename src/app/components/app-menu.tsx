'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BookOpen, Heart, Lock, LogOut, Menu, Plus, Settings, X, type LucideIcon } from 'lucide-react'
import { signOut } from '@/app/(actions)/sign-out'
import { buttonClasses } from '@/app/components/ui/button'
import { categoryDisplayLabel, CATEGORY_ICONS, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath, NOTIFICATIONS_PATH } from '@/lib/routes'
import type { MenuSummary } from '@/lib/menu-summary'
import type { NotificationBadge } from '@/lib/notification-badge'
import { NotificationDot } from './notification-dot'
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

// A "Moje" row: 56 px, 19 px semibold (handoff C5).
const DRAWER_ROW = 'flex min-h-[56px] items-center gap-3 px-5 py-3 text-[19px] font-semibold no-underline! hover:bg-surface-2'

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
      // Menu rows are navigation chrome, shown without the global `a` underline
      // (#390): DRAWER_ROW opts out with no-underline!. The label keeps its own
      // span only for the flex-col layout with the counter and the lock caption.
      className={`${DRAWER_ROW} ${activeClasses(active)}`}
    >
      <Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span>{entry.label}</span>
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
 * "Powiadomienia" in "Moje" (E01-S15b): the single entry point in the header
 * drawer at every width — the standalone bell is gone. A dot (not a number)
 * marks "something new"; its text equivalent is in the row's accessible name.
 */
function NotificationsRow({ badge, active, onNavigate }: { badge: NotificationBadge; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={NOTIFICATIONS_PATH}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`${DRAWER_ROW} ${activeClasses(active)}`}
    >
      <Bell aria-hidden="true" className="h-6 w-6 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span>Powiadomienia</span>
        {badge.loadFailed && <span className="text-[16px] font-normal text-ink-soft">Nie udało się sprawdzić</span>}
      </span>
      {badge.count > 0 && (
        <>
          <NotificationDot className="ml-auto" />
          <span className="sr-only">, masz nowe powiadomienia</span>
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
  notifications,
}: {
  isAuthenticated: boolean
  /** Counters + full access; undefined where the page did not load it. */
  summary?: MenuSummary | null
  /** Signed in only: the "Powiadomienia" row and the MENU badge below lg (#323). */
  notifications?: NotificationBadge | null
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
        // Mobile 1c (E01-S19): icon over a 13 px bold caption, 60x56 like Dodaj.
        // The desktop header (E01-S17) keeps the 48 px inline row.
        className="relative inline-flex h-14 w-[60px] flex-col items-center justify-center gap-0.5 rounded-field text-[13px] leading-none font-bold text-ink hover:bg-surface-3 lg:h-auto lg:min-h-[48px] lg:w-auto lg:flex-row lg:gap-1.5 lg:px-2.5 lg:text-sm lg:leading-5 lg:font-semibold"
      >
        {/* The only header signal for notifications at every width (E01-S15b): a
            fixed-size dot on the MENU icon, never a number — smallest footprint
            for a cramped, large-font navbar. The text equivalent is in the
            button's accessible name. */}
        <span className="relative">
          <Menu aria-hidden="true" className="h-6 w-6 lg:h-5 lg:w-5" />
          {/* count > 0 and loadFailed are mutually exclusive (see notificationBadge). */}
          {notifications && (notifications.count > 0 || notifications.loadFailed) && (
            <NotificationDot className="absolute -top-1.5 -right-1.5" tone={notifications.loadFailed ? 'ink' : 'action'} />
          )}
        </span>
        MENU
        {notifications && notifications.count > 0 && <span className="sr-only">, nowe powiadomienia</span>}
        {notifications?.loadFailed && <span className="sr-only">, nie udało się sprawdzić powiadomień</span>}
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
                  {notifications && (
                    <li>
                      <NotificationsRow
                        badge={notifications}
                        active={pathname === NOTIFICATIONS_PATH}
                        onNavigate={close}
                      />
                    </li>
                  )}
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
              {/* No mid-word break: one column below 360 px (like the home CategoryGrid),
                  two from there up; 16 px + tight spacing keep the longest name ("Ciasteczka")
                  on one line even in the 330 px panel. break-words is the last-resort net
                  (WCAG 1.4.10); bindOrphans (see its doc) handles Polish one-letter words. */}
              <ul className="grid grid-cols-1 gap-2 px-5 min-[360px]:grid-cols-2">
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
                        // the category icon beside a 16 px bold name.
                        className={[
                          'flex h-full min-h-[56px] items-center gap-1.5 rounded-field border-[1.5px] bg-surface-accent px-2 py-2 text-[16px] font-bold break-words no-underline! hover:border-action-text',
                          active ? 'border-action text-action-text' : 'border-border-accent text-ink',
                        ].join(' ')}
                      >
                        <Icon aria-hidden="true" strokeWidth={2} className="h-5 w-5 shrink-0 text-action-text" />
                        <span className="min-w-0">{categoryDisplayLabel(label)}</span>
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
                // Active route: colour plus a background fill, never colour alone
                // (menu items carry no underline — #390).
                className={`${FOOTER_ROW} ${pathname === '/settings' ? 'text-action-text bg-surface-3' : 'text-ink'}`}
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
