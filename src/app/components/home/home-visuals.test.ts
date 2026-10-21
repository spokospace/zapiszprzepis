import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CategoryGrid } from './category-grid'
import { GuestCta } from './guest-cta'
import { HomeSearch } from './home-search'
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
    // Style 1b: white tile, 1 px ink frame, 4 px corners, no tint.
    expect(html).toContain('border-ink')
    expect(html).toContain('rounded-tile')
    expect(html).not.toContain('bg-surface-accent')
    expect(html).toContain('min-h-[76px]')
    expect(html).toContain('text-[16px]')
    // No mid-word break: break-words (a last resort) replaces wrap-anywhere.
    expect(html).toContain('break-words')
    expect(html).not.toContain('wrap-anywhere')
  })

  it('renders the signed-in tile as a 56 px ink-framed row', () => {
    const html = render(createElement(CategoryGrid, { columns: 2 }))
    expect(svgCount(html)).toBe(HOME_CATEGORIES.length)
    expect(html).toContain('h-14')
    expect(html).toContain('border-ink')
    expect(html).not.toContain('border-border-accent')
    expect(html).toContain('text-[16px]')
    expect(html).toContain('break-words')
    expect(html).not.toContain('wrap-anywhere')
    for (const { label } of HOME_CATEGORIES) expect(html).toContain(label)
  })
})

describe('GuestCta (E01-S20)', () => {
  it('is a plain block under a 1 px rule with sign-up and log-in links', () => {
    const html = render(createElement(GuestCta))
    expect(html).toContain('border-t border-ink')
    expect(html).not.toContain('bg-surface-dark')
    expect(html).toContain('Zapisuj przepisy z linku i zbieraj ulubione')
    expect(html).toMatch(/href="\/signup"[^>]*>Załóż konto</)
    expect(html).toMatch(/href="\/login"[^>]*>Zaloguj się</)
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

  it('renders the guest hero field as an ink-framed pill with the A1 placeholder', () => {
    const html = render(createElement(HomeSearch, { id: 'g', tone: 'action', placeholder: 'Danie lub składnik, np. dynia' }))
    expect(html).toContain('border-ink')
    expect(html).toContain('placeholder="Danie lub składnik, np. dynia"')
  })

  it('renders the attached hero field with a visible bold label and a text-only "Szukaj" (handoff 14)', () => {
    const html = render(
      createElement(HomeSearch, {
        id: 'h',
        attached: true,
        tone: 'action',
        label: 'Wpisz nazwę dania lub składnik',
        strongLabel: true,
      }),
    )
    expect(html).toMatch(/<label for="h" class="[^"]*text-\[19px\] font-bold text-ink[^"]*">Wpisz nazwę dania lub składnik</)
    expect(html).toContain('rounded-pill border-2 border-ink')
    // „Szukaj” is a text button, not an icon; the field has no leading icon either.
    expect(html).toMatch(/<button type="submit"[^>]*>Szukaj<\/button>/)
    expect(html).not.toContain('lucide-search')
  })

  it('keeps „Powiedz” out of the attached field', () => {
    // The Web Speech API is absent on the server, so the voice row is not rendered; either
    // way no „Powiedz” button may sit inside the field frame (the old lg:inline-flex one).
    const html = render(createElement(HomeSearch, { id: 'v', attached: true, tone: 'action' }))
    expect(html).not.toContain('lg:inline-flex')
    expect(html).not.toContain('albo')
  })

  it('renders the C1 member label and a single "Szukaj" submit', () => {
    const html = render(
      createElement(HomeSearch, { id: 'm', label: 'Czego szukasz?', strongLabel: true, submitLabel: 'Szukaj' }),
    )
    expect(html).toMatch(/<label for="m" class="[^"]*font-bold[^"]*">Czego szukasz\?</)
    expect(html).toMatch(/type="submit"[^>]*>.*Szukaj<\/button>/)
    expect(html).not.toContain('Szukaj przepisu')
  })

  it('keeps the results-page field compact (C2): sr-only label, Wyczyść inside, no phone submit', () => {
    const html = render(createElement(HomeSearch, { id: 'c', defaultValue: 'dynia', compact: true }))
    expect(html).toMatch(/<label for="c" class="sr-only">/)
    // One Wyczyść, inside the field frame (before the submit button), not in a row below.
    expect(html.match(/Wyczyść/g)).toHaveLength(1)
    expect(html.indexOf('Wyczyść')).toBeLessThan(html.indexOf('type="submit"'))
    expect(html).toMatch(/<button type="submit" class="[^"]*max-lg:hidden/)
  })

  it('shows the Wyczyść row below a non-compact field with a query', () => {
    const html = render(createElement(HomeSearch, { id: 'q', defaultValue: 'dynia' }))
    expect(html.indexOf('Wyczyść')).toBeGreaterThan(html.indexOf('type="submit"'))
    expect(html).not.toContain('max-lg:hidden')
  })
})
