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

  it('hides only the fifth pill on a phone', () => {
    expect(html.match(/max-sm:hidden/g)).toHaveLength(1)
    expect(html).toMatch(/<li class="max-sm:hidden"><a [^>]*>naleśniki</)
  })
})
