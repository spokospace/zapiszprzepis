import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }))

import { SearchScreenBar } from './search-screen-bar'
import { QuickSearchBar } from './quick-search-bar'

describe('SearchScreenBar (handoff v8 screen 4, E01-S26)', () => {
  it('has „✕ Zamknij” below lg, falling back to the start page, and the title', () => {
    const html = renderToStaticMarkup(createElement(SearchScreenBar))
    const close = html.match(/<a[^>]*>.*?<\/a>/)?.[0] ?? ''
    expect(close).toContain('href="/"')
    expect(close).toContain('lg:hidden')
    expect(close).toContain('h-14')
    expect(close).toMatch(/<\/svg>Zamknij<\/a>$/)
    expect(html).toContain('<h1 class="text-[20px] font-bold text-ink lg:sr-only">Szukaj przepisu</h1>')
  })
})

function bar(initialValue: string, isAuthenticated: boolean) {
  return renderToStaticMarkup(
    createElement(QuickSearchBar, { fieldId: 'search-page-field', initialValue, isAuthenticated }),
  )
}

describe('QuickSearchBar (E01-S26)', () => {
  it('shows a guest only the popular searches, as one-tap links to /szukaj', () => {
    const html = bar('', false)
    expect(html).toContain('>Często szukane</p>')
    expect(html).toContain('href="/szukaj?q=sernik"')
    expect(html).toContain('bg-surface-accent')
    expect(html).not.toContain('border-field bg-white')
  })

  it('is titled for recent and popular searches when signed in', () => {
    expect(bar('', true)).toContain('>Ostatnio i często szukane</p>')
  })

  it('stays while one or two letters are typed and hides for a real query', () => {
    expect(bar('dy', true)).toContain('<nav')
    expect(bar('dynia', true)).toBe('')
  })

  it('sticks to the bottom on phones only, with 48 px chips scrolling inside the bar', () => {
    const html = bar('', false)
    expect(html).toMatch(/<nav[^>]*class="fixed inset-x-0 bottom-0[^"]*lg:hidden"/)
    expect(html).toContain('overflow-x-auto')
    expect(html).toContain('min-h-12')
    expect(html).toContain('rounded-pill')
  })
})
