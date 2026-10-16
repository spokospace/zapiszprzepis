'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, Settings, X, type LucideIcon } from 'lucide-react'
import { signOut } from '@/app/(actions)/sign-out'

type MenuLink = { href: string; label: string; icon: LucideIcon }

// Navigation entries of the drawer. Later additions (category shortcuts etc.)
// go here; "Wyloguj" is rendered separately at the bottom.
const MENU_LINKS: MenuLink[] = [{ href: '/settings', label: 'Ustawienia', icon: Settings }]

const LABELED_ICON_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100'

/**
 * Header "MENU" button + right-side drawer. The button carries a visible label
 * next to the hamburger icon, because a bare icon is not obvious to every user.
 * Built on a native `<dialog>` opened with `showModal()`, which gives Escape to
 * close, a focus trap and an inert page behind it without extra code.
 */
export function AppMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()

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
        className={LABELED_ICON_BUTTON}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
        MENU
      </button>

      <dialog
        id="app-menu"
        ref={dialogRef}
        aria-label="Menu"
        // A click on the backdrop lands on the <dialog> element itself; clicks
        // inside the panel land on its children.
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-white p-0 shadow-xl transition-transform duration-200 ease-out backdrop:bg-black/40 starting:open:translate-x-full"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <span className="text-lg font-semibold text-gray-900">Menu</span>
            <button
              type="button"
              onClick={close}
              className={LABELED_ICON_BUTTON}
            >
              <X aria-hidden="true" className="h-5 w-5" />
              Zamknij
            </button>
          </div>

          <nav aria-label="Menu główne" className="flex-1 overflow-y-auto py-2">
            <ul>
              {MENU_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={close}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'flex items-center gap-3 px-5 py-4 text-lg font-medium hover:bg-gray-50',
                        active ? 'text-orange-600' : 'text-gray-800',
                      ].join(' ')}
                    >
                      <Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <form action={signOut} className="border-t border-gray-100 p-2">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-4 text-left text-lg font-medium text-gray-800 hover:bg-gray-50"
            >
              <LogOut aria-hidden="true" className="h-6 w-6 shrink-0" />
              Wyloguj
            </button>
          </form>
        </div>
      </dialog>
    </>
  )
}
