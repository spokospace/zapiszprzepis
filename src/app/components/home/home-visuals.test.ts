import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CategoryGrid } from './category-grid'
import { GuestCta } from './guest-cta'
import { HomeSearch } from './home-search'
import { MemberTiles } from './member-tiles'
import { HOME_CATEGORIES } from '@/lib/recipe-categories'

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)

// Lucide renders every glyph as <svg class="lucide …">.
const svgCount = (html: string) => (html.match(/<svg/g) ?? []).length

describe('CategoryGrid (E01-S20)', () => {
  it('gives every guest tile a decorative icon beside its name', () => {
    const html = render(createElement(CategoryGrid, { columns: 3 }))
    // Home eight + the desktop-only ninth.
    expect(svgCount(html)).toBe(HOME_CATEGORIES.length + 1)
    expect(html).not.toMatch(/<svg(?![^>]*aria-hidden="true")/)
    expect(html).toContain('bg-surface-accent')
    expect(html).toContain('text-[17px]')
  })

  it('renders the signed-in tile as a 56 px accent-framed row', () => {
    const html = render(createElement(CategoryGrid, { columns: 2 }))
    expect(svgCount(html)).toBe(HOME_CATEGORIES.length)
    expect(html).toContain('h-14')
    expect(html).toContain('border-border-accent')
    expect(html).toContain('text-[18px]')
    for (const { label } of HOME_CATEGORIES) expect(html).toContain(label)
  })
})

describe('GuestCta (E01-S20)', () => {
  it('is the dark A1 block with sign-up and log-in links', () => {
    const html = render(createElement(GuestCta))
    expect(html).toContain('bg-surface-dark')
    expect(html).toContain('Zapisuj przepisy z linku i zbieraj ulubione')
    expect(html).toMatch(/href="\/signup"[^>]*>Załóż konto</)
    expect(html).toMatch(/href="\/login"[^>]*>Zaloguj się</)
  })
})

describe('MemberTiles (E01-S20)', () => {
  it('shows three rows with a chevron each for full access', () => {
    const html = render(createElement(MemberTiles, { hasFullAccess: true }))
    expect(html).toContain('Moje przepisy')
    expect((html.match(/lucide-chevron-right/g) ?? []).length).toBe(3)
    expect(html).toContain('text-[20px]')
  })

  it('drops "Moje przepisy" and locks adding without full access', () => {
    const html = render(createElement(MemberTiles, { hasFullAccess: false }))
    expect(html).not.toContain('Moje przepisy')
    expect(html).toContain('Wymaga kodu lub pełnego dostępu')
    expect((html.match(/lucide-chevron-right/g) ?? []).length).toBe(2)
  })
})

describe('HomeSearch looks (E01-S20)', () => {
  it('keeps the default field: grey frame, two-width submit label', () => {
    const html = render(createElement(HomeSearch, { id: 's' }))
    expect(html).toContain('border-field')
    expect(html).toContain('placeholder="np. sernik, pierogi"')
    expect(html).toContain('Szukaj przepisu')
    expect(html).toMatch(/<label for="s"[^>]*>Szukaj przepisu po nazwie lub składniku</)
  })

  it('renders the guest hero field with the orange frame and A1 placeholder', () => {
    const html = render(createElement(HomeSearch, { id: 'g', tone: 'action', placeholder: 'Danie lub składnik, np. dynia' }))
    expect(html).toContain('border-action')
    expect(html).toContain('placeholder="Danie lub składnik, np. dynia"')
  })

  it('renders the C1 member label and a single "Szukaj" submit', () => {
    const html = render(
      createElement(HomeSearch, { id: 'm', label: 'Czego szukasz?', strongLabel: true, submitLabel: 'Szukaj' }),
    )
    expect(html).toMatch(/<label for="m" class="[^"]*font-bold[^"]*">Czego szukasz\?</)
    expect(html).toMatch(/type="submit"[^>]*>.*Szukaj<\/button>/)
    expect(html).not.toContain('Szukaj przepisu')
  })
})
