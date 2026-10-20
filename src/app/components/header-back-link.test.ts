import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }))

import { PageBackLink } from './header-back-link'

describe('PageBackLink', () => {
  it('is „← Wróć” to the start page without a list (history back with JS)', () => {
    const html = renderToStaticMarkup(createElement(PageBackLink, {}))
    expect(html).toContain('href="/"')
    expect(html).toContain('aria-label="Wróć"')
    expect(html).toContain('>Wróć</a>')
  })

  // C3 (E01-S28): on a recipe opened from a list, the header names that list.
  it('names the list and links to it when a recipe page publishes one', () => {
    const html = renderToStaticMarkup(
      createElement(PageBackLink, { target: { label: 'Wyniki', href: '/szukaj?q=dynia' } }),
    )
    expect(html).toContain('href="/szukaj?q=dynia"')
    expect(html).toContain('aria-label="Wróć: Wyniki"')
    // A long category name is cut, never pushing Szukaj + MENU off a 320 px screen.
    expect(html).toContain('<span class="truncate py-1">Wyniki</span>')
    expect(html).toContain('min-w-0')
    expect(html).toContain('h-14')
  })
})
