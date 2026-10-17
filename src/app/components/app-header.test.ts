import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('./app-menu', () => ({ AppMenu: () => createElement('div', { 'data-testid': 'menu' }) }))
vi.mock('./notification-bell', () => ({ NotificationBell: () => createElement('div', { 'data-testid': 'bell' }) }))

import { AppHeader } from './app-header'
import { NO_FAILED_SHARES } from '@/lib/failed-shares'

function render(isAuthenticated: boolean, hasFullAccess = true) {
  return renderToStaticMarkup(
    createElement(AppHeader, {
      failedShares: NO_FAILED_SHARES,
      isAuthenticated,
      menu: { hasFullAccess, myRecipesCount: 0, favoritesCount: 0 },
    }),
  )
}

describe('AppHeader "Dodaj" (1c header, E01-S10)', () => {
  it('is a 64x56 icon-over-label button in the action colour, linking to /dodaj', () => {
    const html = render(true)
    const dodaj = html.match(/<a[^>]*href="\/dodaj"[^>]*>.*?<\/a>/)?.[0] ?? ''
    expect(dodaj).toContain('aria-label="Dodaj przepis"')
    // "Dodaj" below lg; the desktop header (E01-S17, A9) appends " przepis" from lg only.
    expect(dodaj).toContain('>Dodaj<span class="-ml-1.5 hidden lg:inline">')
    expect(dodaj).toContain('h-14 w-16')
    expect(dodaj).toContain('flex-col')
    expect(dodaj).toContain('bg-action')
    expect(dodaj).not.toContain('bg-orange-500')
  })

  it('stays visible without full access — /dodaj shows the code gate (3c)', () => {
    expect(render(true, false)).toContain('href="/dodaj"')
  })

  it('is not shown to a guest, who gets "Zaloguj się" instead', () => {
    const html = render(false)
    expect(html).not.toContain('href="/dodaj"')
    expect(html).toContain('Zaloguj się')
  })
})
