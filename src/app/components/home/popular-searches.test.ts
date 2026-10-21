import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PopularSearches } from './popular-searches'
import { POPULAR_SEARCHES } from '@/lib/home'
import { searchPath } from '@/lib/routes'

const html = renderToStaticMarkup(createElement(PopularSearches))

describe('PopularSearches in the hero (handoff 14)', () => {
  it('sits under a 1 px rule with the lead-in line', () => {
    expect(html).toContain('border-t border-border-card-2')
    expect(html).toContain('Nie wiesz, co wpisać? Kliknij jedno z najczęściej szukanych:')
    expect(html).toContain('aria-label="Często szukane"')
  })

  it('shows the first five terms as 52 px pill links that run the search', () => {
    const shown = POPULAR_SEARCHES.slice(0, 5)
    for (const term of shown) expect(html).toContain(`href="${searchPath(term)}"`)
    expect(html.match(/<a /g)).toHaveLength(5)
    expect(html).not.toContain(searchPath(POPULAR_SEARCHES[5]))
    expect(html).toContain('h-[52px]')
    expect(html).toContain('rounded-pill border-2 border-border-dark')
  })

  it('uses the short lead-in on a phone and the full one from md (3c/3d)', () => {
    expect(html).toMatch(/<span class="md:hidden">Nie wiesz, co wpisać\? Kliknij:<\/span>/)
    expect(html).toMatch(/<span class="max-md:hidden">Nie wiesz, co wpisać\? Kliknij jedno z najczęściej szukanych:<\/span>/)
    expect(html).toContain('pt-4')
  })

  it('centers the lead-in and the pills from md', () => {
    expect(html).toContain('md:items-center')
    expect(html).toContain('md:text-center')
    expect(html).toContain('md:justify-center')
  })

  it('hides only the fifth pill on a phone', () => {
    expect(html.match(/max-sm:hidden/g)).toHaveLength(1)
    expect(html).toMatch(/<li class="max-sm:hidden"><a [^>]*>naleśniki</)
  })
})
