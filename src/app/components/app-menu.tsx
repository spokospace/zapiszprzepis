'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BookOpen, Heart, House, Lock, LogOut, Menu, Plus, Settings, X, type LucideIcon } from 'lucide-react'
import { signOut } from '@/app/(actions)/sign-out'
import { buttonClasses } from '@/app/components/ui/button'
import { categoryDisplayLabel, CATEGORY_ICONS, RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { categoryPath, NOTIFICATIONS_PATH } from '@/lib/routes'
import type { MenuSummary } from '@/lib/menu-summary'
import type { NotificationBadge } from '@/lib/notification-badge'
import { NotificationDot } from './notification-dot'
import { buildMenuModel, newNotificationsNoun, recipesNoun, type MineEntry, type MineEntryKey } from './app-menu-model'

const MINE_ICONS: Record<MineEntryKey, LucideIcon> = {
  'my-recipes': BookOpen,
  favorites: Heart,
  add: Plus,
}

// "× Zamknij": 56 px, 18 px bold (handoff C5).
const LABELED_ICON_BUTTON =
  'inline-flex min-h-14 items-center gap-1.5 rounded-pill px-3 text-[18px] font-bold text-ink hover:bg-surface-3'

// "Ustawienia | Wyloguj": 64 px rows, 18 px bold (handoff C5). no-underline!:
// "Ustawienia" is a <Link>, so the global `a` underline would show through
// (menu items carry no underline — #390); the ! beats the unlayered `a` rule.
const FOOTER_ROW = 'flex min-h-16 items-center justify-center gap-2 text-[18px] font-bold no-underline! hover:bg-surface-2'

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
 * drawer at every width — the standalone bell is gone. A counter marks
 * "something new"; its text equivalent is in the row's accessible name.
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
          {/* A counter, not a dot (style 1b): at least 28 px square, #c2410c with white
              16 px bold text (5.2:1); its text equivalent is the sr-only count below. */}
          <span
            aria-hidden="true"
            className="ml-auto inline-flex min-h-7 min-w-7 items-center justify-center rounded-pill bg-action px-2 text-[16px] leading-none font-bold text-white"
          >
            {badge.count}
          </span>
          <span className="sr-only">
            , {badge.count} {newNotificationsNoun(badge.count)}
          </span>
        </>
      )}
    </Link>
  )
}

/**
 * Header "MENU" button + drawer (E01-S09): "Moje" (or the guest's sign-in
 * CTA), every category, and the "Ustawienia | Wyloguj" footer. Full screen on
 * phones, a 460px right-side panel from `sm` up. Built on a native `<dialog>`
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
        // Mobile 1c (E01-S19, #412): icon over a 16 px bold caption, at least 64x56.
        // The desktop header (E01-S17) keeps the 48 px inline row.
        className="relative inline-flex h-14 min-w-16 flex-col items-center justify-center gap-0.5 rounded-pill text-base leading-none font-bold text-ink hover:bg-surface-3 lg:h-auto lg:min-h-[48px] lg:w-auto lg:flex-row lg:gap-1.5 lg:px-2.5 lg:text-sm lg:leading-5 lg:font-semibold"
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
        Menu
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
        // A transparent full-viewport frame that never moves: the panel inside slides,
        // and this box clips it. Sliding the <dialog> itself put its box up to a full
        // viewport width past the right edge mid-animation, which left the page
        // sideways-scrollable on Android with a larger system font (#448). `clip`, not
        // `hidden`: a clip box is no scroll container, so focus can't scroll the panel.
        className="group fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-clip bg-transparent p-0 text-ink backdrop:bg-black/40 backdrop:transition-opacity backdrop:duration-200 backdrop:ease-out backdrop:motion-reduce:transition-none starting:open:backdrop:opacity-0"
      >
        {/* Open animation (ZMIANY_prototyp §4): the panel slides in (280 ms), the backdrop
            fades (200 ms); prefers-reduced-motion drops both. Desktop panel 460 px with a
            soft left shadow; mobile stays full width. */}
        <div className="ml-auto flex h-full w-full flex-col bg-surface transition-transform duration-[280ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none starting:group-open:translate-x-full sm:w-[460px] sm:shadow-[-12px_0_32px_rgba(17,24,39,0.18)]">
          <div className="flex shrink-0 items-center justify-between border-b-2 border-border-card py-1 pr-2 pl-5">
            <h2 id="app-menu-title" className="text-[22px] font-bold text-ink">
              Menu
            </h2>
            <button type="button" onClick={close} className={LABELED_ICON_BUTTON}>
              <X aria-hidden="true" className="h-6 w-6" />
              Zamknij
            </button>
          </div>

          <nav aria-label="Menu główne" className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-4">
            {/* Style 1b: the start page is the first item for everyone. `replace` swaps the
                history entry, so Back does not walk through the pages visited before. */}
            <Link
              href="/"
              replace
              onClick={close}
              aria-current={pathname === '/' ? 'page' : undefined}
              className={`flex min-h-14 items-center gap-3 border-b-2 border-border-card px-5 text-[19px] font-bold no-underline! hover:bg-surface-2 ${
                pathname === '/' ? 'bg-surface-3 text-action-text' : 'text-ink'
              }`}
            >
              <House aria-hidden="true" className="h-6 w-6 shrink-0" />
              Strona główna
            </Link>
            <div className="pt-4" />
            {mine ? (
              <section aria-labelledby="app-menu-mine" className="pb-4">
                <h3 id="app-menu-mine" className={SECTION_HEADING}>
                  Twoje konto
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
              <ul className="grid grid-cols-1 border-t border-border-card-2 min-[360px]:grid-cols-2">
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
                        // Style 1b: a flat row — 56 px, a 1 px #d1d5db line below, a 20 px #9a3412
                        // icon and a 17 px bold name; no background or radius. The current
                        // category adds a fill, never colour alone.
                        className={[
                          'flex h-full min-h-[56px] items-center gap-2 border-b border-border-card-2 px-5 py-2 text-[17px] font-bold break-words no-underline! hover:bg-surface-2',
                          active ? 'bg-surface-3 text-action-text' : 'text-ink',
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
