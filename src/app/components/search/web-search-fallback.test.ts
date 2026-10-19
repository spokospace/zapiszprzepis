import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/app/(authenticated)/recipes/search-via-exa-action', () => ({ searchViaExa: vi.fn() }))
vi.mock('@/app/(authenticated)/recipes/add-recipe-action', () => ({ addRecipeFromUrl: vi.fn() }))

import { WebSearchFallback } from './web-search-fallback'

function render(isAuthenticated: boolean, hasFullAccess = false) {
  return renderToStaticMarkup(createElement(WebSearchFallback, { q: 'dynia', isAuthenticated, hasFullAccess, hasResults: true }))
}

describe('WebSearchFallback', () => {
  it('asks a guest to sign in and come back to this search — no external search, no new tab', () => {
    const html = render(false)
    expect(html).toContain('href="/login?next=%2Fszukaj%3Fq%3Ddynia"')
    expect(html).toContain('Zaloguj się i szukaj w internecie')
    expect(html).not.toContain('target="_blank"')
    expect(html).not.toContain('google.com')
    expect(html).not.toContain('nowej karcie')
  })

  it('gives any signed-in account the in-place Exa search, even without full access', () => {
    const html = render(true, false)
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>.*Szukaj „dynia” w internecie<\/button>/)
    expect(html).not.toContain('href="/login')
    expect(html).not.toContain('nowej karcie')
  })
})
