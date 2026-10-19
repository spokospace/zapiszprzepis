import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let pathname = '/przepisy/zupy'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('@/app/(actions)/sign-out', () => ({ signOut: vi.fn() }))

import { AppMenu } from './app-menu'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import type { NotificationBadge } from '@/lib/notification-badge'

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

// Owner decision (#323): below lg the phone header has no bell; the drawer row and
// the MENU badge carry it, hidden from lg where the header bell is back.
describe('AppMenu "Powiadomienia" below lg (#323)', () => {
  const summary = { hasFullAccess: true, myRecipesCount: 3, favoritesCount: 1 }
  function renderMenu(notifications: NotificationBadge | null, isAuthenticated = true) {
    return renderToStaticMarkup(createElement(AppMenu, { isAuthenticated, summary, notifications }))
  }
  function menuButton(html: string): string {
    return html.match(/<button[^>]*aria-controls="app-menu"[^>]*>.*?<\/button>/)?.[0] ?? ''
  }
  function row(html: string): string {
    return html.match(/<li class="lg:hidden"><a[^>]*href="\/powiadomienia"[^>]*>.*?<\/a><\/li>/)?.[0] ?? ''
  }

  it('lists a "Powiadomienia" row in "Moje", below lg only, with a red counter named for screen readers', () => {
    const r = row(renderMenu({ count: 2, loadFailed: false }))
    expect(r).toContain('Powiadomienia')
    expect(r).toContain('bg-danger')
    expect(r).toContain('>2</span>')
    expect(r).toContain(', 2 powiadomienia')
  })

  it('puts the badge on the MENU button, in its accessible name, below lg only', () => {
    const button = menuButton(renderMenu({ count: 5, loadFailed: false }))
    expect(button).toMatch(/<span aria-hidden="true" class="[^"]*bg-danger[^"]*lg:hidden">5<\/span>/)
    expect(button).toContain('<span class="sr-only lg:hidden">, 5 powiadomień</span>')
  })

  it('shows no counter and no badge when there is nothing new', () => {
    const html = renderMenu({ count: 0, loadFailed: false })
    expect(row(html)).not.toContain('bg-danger')
    expect(menuButton(html)).not.toContain('bg-danger')
  })

  it('says the check failed instead of showing a confident zero', () => {
    const html = renderMenu({ count: 0, loadFailed: true })
    expect(row(html)).toContain('Nie udało się sprawdzić')
    // The bell's dot colour (#326): amber-500 is 2.1:1 on white, below 3:1 for UI (#335).
    expect(menuButton(html)).toContain('border-white bg-ink')
    expect(menuButton(html)).not.toContain('amber')
    expect(menuButton(html)).toContain('nie udało się sprawdzić powiadomień')
  })

  it('marks the row current on /powiadomienia', () => {
    pathname = '/powiadomienia'
    expect(row(renderMenu({ count: 0, loadFailed: false }))).toContain('aria-current="page"')
    pathname = '/przepisy/zupy'
  })

  it('gives a guest neither the row nor a badge', () => {
    const html = renderMenu(null, false)
    expect(html).not.toContain('href="/powiadomienia"')
    expect(menuButton(html)).not.toContain('bg-danger')
  })
})
