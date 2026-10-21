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
  it('renders every category as a flat icon + name row (no tile background), without an underline', () => {
    const links = categoryLinks()
    expect(links).toHaveLength(RECIPE_CATEGORIES.length)
    for (const link of links) {
      expect(link).not.toContain('bg-surface-accent')
      expect(link).not.toContain('rounded-field')
      expect(link).toContain('border-b border-border-card-2')
      expect(link).toContain('min-h-[56px]')
      expect(link).toContain('no-underline!')
      expect(link).toContain('<svg')
      expect(link).toContain('aria-hidden="true"')
    }
  })

  it('keeps names on one line without a mid-word break, binding Polish orphans', () => {
    const html = renderToStaticMarkup(createElement(AppMenu, { isAuthenticated: false, summary: null }))
    // One column on the narrowest phones, two from 360px up (the 330px panel stays legible).
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('min-[360px]:grid-cols-2')
    const links = categoryLinks()
    for (const link of links) {
      // break-words breaks only as a last resort; wrap-anywhere split words mid-character.
      expect(link).toContain('break-words')
      expect(link).not.toContain('wrap-anywhere')
    }
    // "Syropy i napary": the one-letter "i" is bound to "napary" with a non-breaking space.
    const syropy = links.find((l) => l.includes('href="/przepisy/syropy"')) ?? ''
    expect(syropy).toContain('i napary')
  })

  it('marks the current category with a fill and the action colour', () => {
    const current = categoryLinks().find((l) => l.includes('href="/przepisy/zupy"')) ?? ''
    expect(current).toContain('aria-current="page"')
    expect(current).toContain('bg-surface-3 text-action-text')
  })
})

// E01-S15b: the standalone bell is gone. At every width the MENU button carries
// a dot (not a number) and the drawer has a "Powiadomienia" row; the text
// equivalent lives in the control's accessible name.
describe('AppMenu "Powiadomienia" (E01-S15b)', () => {
  const summary = { hasFullAccess: true, myRecipesCount: 3, favoritesCount: 1 }
  function renderMenu(notifications: NotificationBadge | null, isAuthenticated = true) {
    return renderToStaticMarkup(createElement(AppMenu, { isAuthenticated, summary, notifications }))
  }
  function menuButton(html: string): string {
    return html.match(/<button[^>]*aria-controls="app-menu"[^>]*>.*?<\/button>/)?.[0] ?? ''
  }
  function row(html: string): string {
    return html.match(/<li><a[^>]*href="\/powiadomienia"[^>]*>.*?<\/a><\/li>/)?.[0] ?? ''
  }

  it('lists a "Powiadomienia" row in "Moje" at every width, with a counter named for screen readers', () => {
    const r = row(renderMenu({ count: 2, loadFailed: false }))
    expect(r).toContain('Powiadomienia')
    expect(r).toContain('bg-action')
    // A counter (style 1b), hidden from assistive tech; the sr-only text carries the count.
    expect(r).toMatch(/<span aria-hidden="true" class="[^"]*min-w-7[^"]*">2<\/span>/)
    expect(r).toContain(', 2 nowe powiadomienia')
  })

  it('puts a dot on the MENU button, with the text equivalent in its accessible name', () => {
    const button = menuButton(renderMenu({ count: 5, loadFailed: false }))
    expect(button).toMatch(/<span aria-hidden="true" class="[^"]*bg-action[^"]*"><\/span>/)
    expect(button).toContain('<span class="sr-only">, nowe powiadomienia</span>')
    // No number, and shown at every width (no lg:hidden gate on the dot).
    expect(button).not.toContain('>5</span>')
    expect(button).not.toMatch(/bg-action[^"]*lg:hidden/)
  })

  it('shows no dot anywhere when there is nothing new', () => {
    const html = renderMenu({ count: 0, loadFailed: false })
    expect(row(html)).not.toContain('bg-action')
    expect(menuButton(html)).not.toContain('bg-action')
  })

  it('says the check failed instead of showing a confident zero', () => {
    const html = renderMenu({ count: 0, loadFailed: true })
    expect(row(html)).toContain('Nie udało się sprawdzić')
    // The load-fail dot colour (#326): amber-500 is 2.1:1 on white, below 3:1 for UI (#335).
    expect(menuButton(html)).toContain('border-white bg-ink')
    expect(menuButton(html)).not.toContain('amber')
    expect(menuButton(html)).toContain('nie udało się sprawdzić powiadomień')
  })

  it('marks the row current on /powiadomienia', () => {
    pathname = '/powiadomienia'
    expect(row(renderMenu({ count: 0, loadFailed: false }))).toContain('aria-current="page"')
    pathname = '/przepisy/zupy'
  })

  it('gives a guest neither the row nor a dot', () => {
    const html = renderMenu(null, false)
    expect(html).not.toContain('href="/powiadomienia"')
    expect(menuButton(html)).not.toContain('bg-action')
  })
})

// #390: menu/drawer items are navigation chrome, shown without the global `a`
// underline. Rows keep the row-level `no-underline!` opt-out; the label itself
// carries no underline, and the active footer link is marked without one too.
describe('AppMenu items carry no underline (#390)', () => {
  const summary = { hasFullAccess: true, myRecipesCount: 3, favoritesCount: 1 }

  it('renders the "Moje" rows and "Powiadomienia" without a label underline', () => {
    const html = renderToStaticMarkup(
      createElement(AppMenu, { isAuthenticated: true, summary, notifications: { count: 0, loadFailed: false } }),
    )
    // The rows still opt out of the global `a` underline at the row level...
    expect(html).toContain('no-underline!')
    // ...and underline-offset-4 — used only on the old drawer/footer label
    // underlines — is gone everywhere.
    expect(html).not.toContain('underline-offset-4')
  })

  it('marks the active footer item with a background, not colour or an underline', () => {
    pathname = '/settings'
    const html = renderToStaticMarkup(
      createElement(AppMenu, { isAuthenticated: true, summary, notifications: null }),
    )
    const settings = html.match(/<a[^>]*href="\/settings"[^>]*>.*?<\/a>/)?.[0] ?? ''
    expect(settings).toContain('aria-current="page"')
    expect(settings).toContain('text-action-text')
    // A non-colour affordance (never colour alone — WCAG 1.4.1) that is not an underline.
    expect(settings).toContain('bg-surface-3')
    // Opts out of the global `a` underline (it is a <Link>), and no offset utility.
    expect(settings).toContain('no-underline!')
    expect(settings).not.toContain('underline-offset')
    pathname = '/przepisy/zupy'
  })
})

describe('AppMenu style 1b', () => {
  const html = (isAuthenticated: boolean) => renderToStaticMarkup(createElement(AppMenu, { isAuthenticated, summary: null }))

  it('starts the drawer with "Strona główna" for a guest and a signed-in user, replacing history', () => {
    for (const signedIn of [true, false]) {
      const nav = html(signedIn).match(/<nav[^>]*aria-label="Menu główne"[^>]*>.*?<\/nav>/)?.[0] ?? ''
      const first = nav.match(/<a [^>]*>.*?<\/a>/)?.[0] ?? ''
      expect(first).toContain('href="/"')
      expect(first).toContain('Strona główna')
    }
  })

  it('names the button "Menu" in sentence case at 16 px, at least 64 px wide (#412)', () => {
    const button = html(true).match(/<button[^>]*aria-controls="app-menu"[^>]*>.*?<\/button>/)?.[0] ?? ''
    expect(button).toContain('Menu')
    expect(button).not.toContain('MENU')
    expect(button).toContain('min-w-16')
    expect(button).toContain('text-base')
  })

  it('keeps the header bar fixed while only the list scrolls', () => {
    const out = html(true)
    expect(out).toContain('overflow-clip')
    expect(out).toContain('overscroll-contain')
  })

  it('slides the panel inside a fixed, clipping <dialog>, never the <dialog> itself (#448)', () => {
    const out = html(false)
    const dialog = out.match(/<dialog[^>]*class="([^"]+)"/)?.[1] ?? ''
    const panel = out.match(/<dialog[^>]*>\s*<div class="([^"]+)"/)?.[1] ?? ''
    expect(dialog).toMatch(/(^| )inset-0( |$)/)
    expect(dialog).toContain('overflow-clip')
    expect(dialog).not.toContain('translate-x-full')
    expect(panel).toContain('starting:group-open:translate-x-full')
    expect(panel).toContain('motion-reduce:transition-none')
    expect(panel).toContain('sm:w-[460px]')
  })
})
