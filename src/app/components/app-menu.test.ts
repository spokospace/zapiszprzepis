import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ usePathname: () => '/przepisy/zupy' }))
vi.mock('@/app/(actions)/sign-out', () => ({ signOut: vi.fn() }))

import { AppMenu } from './app-menu'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

function categoryLinks(): string[] {
  const html = renderToStaticMarkup(createElement(AppMenu, { isAuthenticated: false, summary: null }))
  return html.match(/<a[^>]*href="\/przepisy\/[^"]*"[^>]*>.*?<\/a>/g) ?? []
}

describe('AppMenu category tiles (C5)', () => {
  it('renders every category as an icon + name tile on the accent surface, without an underline', () => {
    const links = categoryLinks()
    expect(links).toHaveLength(RECIPE_CATEGORIES.length)
    for (const link of links) {
      expect(link).toContain('bg-surface-accent')
      expect(link).toContain('no-underline!')
      expect(link).toContain('<svg')
      expect(link).toContain('aria-hidden="true"')
    }
  })

  it('frames the current category in the action colour', () => {
    const current = categoryLinks().find((l) => l.includes('href="/przepisy/zupy"')) ?? ''
    expect(current).toContain('aria-current="page"')
    expect(current).toContain('border-action ')
  })
})
