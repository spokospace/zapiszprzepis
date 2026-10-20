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
vi.mock('./app-menu', () => ({
  AppMenu: ({ notifications }: { notifications?: unknown }) =>
    createElement('div', { 'data-testid': 'menu', 'data-notifications': JSON.stringify(notifications ?? null) }),
}))
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

describe('AppHeader "Dodaj przepis" (desktop A9; handoff v8, E01-S25)', () => {
  it('is a desktop-only button in the action colour, linking to /dodaj — in MENU below lg', () => {
    const html = render(true)
    const dodaj = html.match(/<a[^>]*href="\/dodaj"[^>]*>.*?<\/a>/)?.[0] ?? ''
    expect(dodaj).toMatch(/class="hidden /)
    expect(dodaj).toContain('lg:inline-flex')
    expect(dodaj).toContain('Dodaj przepis</a>')
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

  it('moves a guest\'s "Zaloguj się" into MENU below lg, keeping the outlined button on desktop', () => {
    pathname = '/'
    const login = render(false).match(/<a[^>]*href="\/login"[^>]*>Zaloguj się<\/a>/)?.[0] ?? ''
    expect(login).toMatch(/class="hidden /)
    expect(login).toContain('lg:inline-flex')
    expect(login).toContain('border-2 border-field')
  })

  // #286 followed the design handoff back to the old lettering image and undid #276 (#320).
  // Handoff v8 (E01-S25): below lg the text „Zapisz Przepis” alone; the icon from lg.
  it('shows the text logo below lg and the icon only from lg, never the old lettering image', () => {
    pathname = '/'
    for (const signedIn of [true, false]) {
      const html = render(signedIn)
      expect(html).not.toContain('logo-lettering.svg')
      const icon = html.match(/<img[^>]*src="\/logo-icon.svg"[^>]*>/)?.[0] ?? ''
      expect(icon).toMatch(/class="hidden [^"]*lg:block/)
      const wordmark = html.match(/<span aria-hidden="true" class="([^"]*)">.*?Przepis<\/span><\/span>/)
      expect(wordmark?.[0]).toContain('>Zapisz</span>')
      const classes = (wordmark?.[1] ?? '').split(' ')
      expect(classes).not.toContain('hidden')
      // 24 px from 360 px; 20 px below, so the text + Szukaj + MENU fit at 320 px.
      expect(classes).toEqual(expect.arrayContaining(['text-[20px]', 'min-[360px]:text-[24px]', 'lg:text-[1.625rem]']))
    }
  })

  it.each(['/szukaj', '/settings', '/dodaj', '/powiadomienia', '/przepisy/zupy', '/u/ania', '/przepis/sernik'])(
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

  it('keeps the signed-in "← Wróć" in one 18 px row beside Szukaj + MENU', () => {
    pathname = '/szukaj'
    const back = render(true).match(/<a[^>]*aria-label="Wróć"[^>]*>/)?.[0] ?? ''
    expect(back).toContain('flex-row')
    expect(back).toContain('text-[18px]')
    expect(back).not.toContain('flex-col')
    pathname = '/'
  })

  it('keeps the logo and no back link on the start page', () => {
    pathname = '/'
    const html = render(true)
    expect(html).not.toContain('aria-label="Wróć')
    expect(html).not.toContain('hidden lg:flex min-h-12')
  })
})

// Owner decision (#323): below lg „Powiadomienia” lives in the MENU drawer, not the header.
describe('AppHeader "Powiadomienia" placement (#323)', () => {
  it('shows the bell from lg only', () => {
    pathname = '/'
    expect(render(true)).toContain('<div class="hidden lg:flex"><div data-testid="bell"></div></div>')
  })

  it('hands the badge to the MENU drawer for a signed-in user, and nothing for a guest', () => {
    pathname = '/'
    expect(render(true)).toContain(`data-notifications="${'{&quot;count&quot;:0,&quot;loadFailed&quot;:false}'}"`)
    const guest = render(false)
    expect(guest).toContain('data-notifications="null"')
    expect(guest).not.toContain('data-testid="bell"')
  })
})

/** The phone header's „Szukaj” button (the desktop header has its own search links). */
function searchButton(html: string): string {
  return html.match(/<a[^>]*>(?:(?!<\/a>).)*<\/svg>Szukaj<\/a>/)?.[0] ?? ''
}

// Handoff v8 (E01-S25): one-tap search from every screen below lg, for everyone.
describe('AppHeader "Szukaj" (handoff v8, E01-S25)', () => {
  it.each(['/', '/przepis/sernik', '/settings', '/przepisy/zupy'])('is a 64x56 icon-over-label link to /szukaj below lg on %s', (path) => {
    pathname = path
    for (const signedIn of [true, false]) {
      const link = searchButton(render(signedIn))
      expect(link).toContain('href="/szukaj"')
      expect(link).toContain('h-14 w-16')
      expect(link).toContain('flex-col')
      expect(link).toContain('lg:hidden')
      expect(link).toMatch(/<svg[^>]*aria-hidden="true"[^>]*>.*<\/svg>Szukaj<\/a>$/)
    }
    pathname = '/'
  })

  it('is not shown on /szukaj, which has the field', () => {
    pathname = '/szukaj'
    for (const signedIn of [true, false]) expect(searchButton(render(signedIn))).toBe('')
    pathname = '/'
  })
})

describe('AppHeader on /szukaj (E01-S26)', () => {
  it('steps aside below lg for the full-screen search bar, and stays from lg', () => {
    pathname = '/szukaj'
    expect(render(true)).toMatch(/<header class="[^"]*max-lg:hidden/)
    pathname = '/'
    expect(render(true)).not.toContain('max-lg:hidden')
  })
})
