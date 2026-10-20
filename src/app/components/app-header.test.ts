import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
// The header search field pulls in the /szukaj suggestions action; keep it out of this
// SSR render (it reaches for the Supabase server client).
vi.mock('@/app/szukaj/actions', () => ({ getSuggestions: vi.fn(async () => []) }))
let pathname = '/'
let searchString = ''
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(searchString),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))
vi.mock('./app-menu', () => ({
  AppMenu: ({ notifications }: { notifications?: unknown }) =>
    createElement('div', { 'data-testid': 'menu', 'data-notifications': JSON.stringify(notifications ?? null) }),
}))

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

// E01-S15b: the standalone desktop bell is gone; „Powiadomienia” is signalled by
// a dot on the MENU button and reached from the MENU drawer and Settings.
describe('AppHeader "Powiadomienia" placement (E01-S15b)', () => {
  it('renders no standalone notification bell at any width', () => {
    pathname = '/'
    expect(render(true)).not.toContain('data-testid="bell"')
  })

  it('hands the badge to the MENU drawer for a signed-in user, and nothing for a guest', () => {
    pathname = '/'
    expect(render(true)).toContain(`data-notifications="${'{&quot;count&quot;:0,&quot;loadFailed&quot;:false}'}"`)
    expect(render(false)).toContain('data-notifications="null"')
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

function headerSearchInput(html: string): string {
  return html.match(/<input[^>]*id="header-search"[^>]*>/)?.[0] ?? ''
}

// E01-S17 follow-up (#navbar-search): the desktop header carries one combobox search
// field — the single search surface — rendered on every signed-in page incl /szukaj.
describe('AppHeader desktop search field (E01-S17 follow-up)', () => {
  it('is left out on the start page, whose hero already has the one field (E01-S31 §5)', () => {
    pathname = '/'
    const html = render(true)
    expect(headerSearchInput(html)).toBe('')
    expect(html).not.toContain('aria-label="Szukaj w serwisie"')
  })

  it.each(['/szukaj', '/przepis/sernik', '/settings'])('is one combobox GET field on %s', (path) => {
    pathname = path
    const html = render(true)
    const input = headerSearchInput(html)
    expect(input).toContain('role="combobox"')
    expect(input).toContain('name="q"')
    expect(input).toContain('aria-controls="header-search-panel"')
    expect(html).toContain('aria-label="Szukaj w serwisie"')
    // Desktop-only; the field never shows below lg (the „Szukaj” link does).
    expect(html).toMatch(/role="search"[^>]*class="[^"]*hidden lg:flex/)
    pathname = '/'
  })

  it('is not rendered for a guest', () => {
    pathname = '/'
    expect(headerSearchInput(render(false))).toBe('')
  })

  it('prefills the active query on /szukaj so the page drops its own desktop field', () => {
    pathname = '/szukaj'
    searchString = 'q=sernik'
    expect(headerSearchInput(render(true))).toContain('value="sernik"')
    searchString = ''
    pathname = '/'
  })

  it('does not prefill off the search page', () => {
    pathname = '/'
    searchString = 'q=sernik'
    expect(headerSearchInput(render(true))).not.toContain('value="sernik"')
    searchString = ''
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

// #226: a layout hands the header its data unawaited, so the page is not held back.
describe('AppHeader while the notifications check and counters load (#226)', () => {
  function renderPending() {
    const never = new Promise<never>(() => {})
    return renderToStaticMarkup(
      createElement(AppHeader, { failedShares: never, isAuthenticated: true, menu: never }),
    )
  }

  it('keeps a working MENU without a badge until the counts arrive', () => {
    pathname = '/'
    expect(renderPending()).toContain('data-testid="menu" data-notifications="null"')
  })
})

// E01-S31 §5: the signed-in desktop nav leads with „Moje przepisy” / „Ulubione” and „Kategorie ▾”.
describe('AppHeader signed-in desktop nav (E01-S31 §5)', () => {
  const nav = (html: string) => html.match(/<nav aria-label="Przepisy"[^>]*>.*?<\/nav>/)?.[0] ?? ''

  it('shows „Moje przepisy”, „Ulubione” and „Kategorie” from xl, in place of „Przepisy”', () => {
    const html = nav(render(true))
    expect(html).toMatch(/max-xl:hidden[^>]*href="\/recipes">Moje przepisy</)
    expect(html).toMatch(/max-xl:hidden[^>]*href="\/ulubione">Ulubione</)
    expect(html).toContain('Kategorie')
    expect(html).not.toMatch(/href="\/szukaj">Przepisy</)
  })

  it('drops „Moje przepisy” without full access', () => {
    expect(nav(render(true, false))).not.toContain('Moje przepisy')
  })

  it('keeps „Przepisy” and „Kategorie” for a guest', () => {
    const html = nav(render(false))
    expect(html).toMatch(/href="\/szukaj">Przepisy</)
    expect(html).not.toContain('Ulubione')
  })
})
