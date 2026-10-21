import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CategoryGrid } from './category-grid'
import { GuestCta } from './guest-cta'
import { HomeSearch } from './home-search'
import { AttentionBanner } from './attention-banner'
import type { FailedSharesResult } from '@/lib/failed-shares'
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

describe('AttentionBanner (E01-S31 §5)', () => {
  const failed = { status: 'ok', shares: [{}] } as unknown as FailedSharesResult

  it('is a white strip with a 2 px #9a3412 frame and a "Popraw" link, not the red tint', () => {
    const html = render(createElement(AttentionBanner, { failedShares: failed }))
    expect(html).toContain('border-action-text')
    expect(html).toContain('bg-white')
    expect(html).not.toContain('bg-danger-bg')
    expect(html).toContain('1 przepis wymaga uwagi')
    expect(html).toMatch(/>Popraw</)
    expect(html).not.toContain('Zobacz')
  })

  it('renders nothing when nothing needs attention', () => {
    const none = { status: 'ok', shares: [] } as unknown as FailedSharesResult
    expect(render(createElement(AttentionBanner, { failedShares: none }))).toBe('')
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
