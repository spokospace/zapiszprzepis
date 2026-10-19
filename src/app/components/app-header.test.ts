import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
let pathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ back: vi.fn() }),
}))
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

describe('AppHeader mobile 1c layout (E01-S19)', () => {
  it('has the 2 px bottom border and the 4/12/4/16 padding below lg', () => {
    pathname = '/'
    const html = render(true)
    expect(html).toContain('border-b-2 border-border-card')
    expect(html).toContain('py-1 pr-3 pl-4')
  })

  it('gives a guest an outlined 52 px "Zaloguj się"', () => {
    pathname = '/'
    const login = render(false).match(/<a[^>]*href="\/login"[^>]*>Zaloguj się<\/a>/)?.[0] ?? ''
    expect(login).toContain('min-h-[52px]')
    expect(login).toContain('border-2 border-field')
  })

  // #286 followed the design handoff back to the old lettering image and undid #276 (#320).
  it('shows the recipe icon + wordmark logo, never the old lettering image', () => {
    pathname = '/'
    for (const signedIn of [true, false]) {
      const html = render(signedIn)
      expect(html).toContain('src="/logo-icon.svg"')
      expect(html).not.toContain('logo-lettering.svg')
      // The icon alone on phones; the wordmark from sm (tablet) up, desktop included.
      const wordmark = html.match(/<span aria-hidden="true" class="[^"]*">.*?Przepis<\/span><\/span>/)?.[0] ?? ''
      expect(wordmark).toContain('hidden')
      expect(wordmark).toContain('sm:inline')
      expect(wordmark).toContain('>Zapisz</span>')
    }
  })

  it('replaces the logo with "← Wróć" on a recipe page, for guests too, below lg only', () => {
    pathname = '/przepis/sernik'
    for (const signedIn of [true, false]) {
      const html = render(signedIn)
      const back = html.match(/<a[^>]*aria-label="Wróć[^"]*"[^>]*>.*?<\/a>/)?.[0] ?? ''
      // Without list context it returns to the start page.
      expect(back).toContain('href="/"')
      expect(back).toContain('lg:hidden')
      expect(back).toContain('h-14')
      expect(back).toContain('>Wróć</a>')
      expect(html).toContain('hidden lg:flex')
      // The old chevron to the owner-only /recipes is gone.
      expect(html).not.toContain('href="/recipes"')
    }
    pathname = '/'
  })

  it.each(['/szukaj', '/settings', '/dodaj', '/powiadomienia', '/przepisy/zupy', '/u/ania'])(
    'replaces the logo with a plain "← Wróć" below lg on %s',
    (path) => {
      pathname = path
      for (const signedIn of [true, false]) {
        const html = render(signedIn)
        const back = html.match(/<a[^>]*aria-label="Wróć"[^>]*>.*?<\/a>/)?.[0] ?? ''
        // No-JS / no-history fallback: the start page.
        expect(back).toContain('href="/"')
        expect(back).toContain('lg:hidden')
        expect(back).toContain('h-14')
        expect(back).toContain('>Wróć</a>')
        // The logo link stays for the desktop header only.
        expect(html).toContain('hidden lg:flex')
      }
      pathname = '/'
    },
  )

  it('keeps the logo and no back link on the start page', () => {
    pathname = '/'
    const html = render(true)
    expect(html).not.toContain('aria-label="Wróć')
    expect(html).not.toContain('hidden lg:flex min-h-12')
  })
})
