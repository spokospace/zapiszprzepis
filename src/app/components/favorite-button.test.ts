import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FavoriteButton } from './favorite-button'

vi.mock('next/navigation', () => ({ usePathname: () => '/szukaj' }))
vi.mock('@/app/favorites/actions', () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }))

const heart = (props: Partial<Parameters<typeof FavoriteButton>[0]>) =>
  renderToStaticMarkup(
    createElement(FavoriteButton, { recipeId: 7, initialFavorited: false, isAuthenticated: true, ...props }),
  )

describe('FavoriteButton on a card photo', () => {
  it('is a heart alone, named by its label and the recipe', () => {
    const html = heart({ size: 'photo', recipeTitle: 'Sernik' })
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="Dodaj do ulubionych: Sernik"/)
    expect(html).toContain('h-12 w-12')
    // No visible label next to the icon.
    expect(html).toMatch(/<\/svg><\/button>/)
  })

  it('names the saved state and fills the heart', () => {
    const html = heart({ size: 'photo', recipeTitle: 'Sernik', initialFavorited: true })
    expect(html).toContain('aria-label="W ulubionych: Sernik"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('fill="currentColor"')
  })

  it('gives a guest the same named heart as a button, with no login link for crawlers to follow', () => {
    const html = heart({ size: 'photo', recipeTitle: 'Sernik', isAuthenticated: false })
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Dodaj do ulubionych: Sernik"/)
    expect(html).not.toContain('href=')
    expect(html).not.toContain('fav=')
  })
})

describe('FavoriteButton on the recipe page (handoff 2026-10-28)', () => {
  it('is a 60 px button with an orange outline, as tall as its row', () => {
    const button = heart({}).match(/<button[^>]*>/)?.[0]
    expect(button).toContain('min-h-[60px]')
    expect(button).toContain('h-full')
    expect(button).toContain('border-2 border-action')
    expect(button).toContain('text-action-text')
  })

  it('reads "Zapisz" and is named "Zapisz w ulubionych", with no aria-label', () => {
    const html = heart({})
    expect(html).toContain('<span>Zapisz<span class="sr-only"> w ulubionych</span></span>')
    expect(html).not.toContain('aria-label')
    expect(html).toContain('aria-pressed="false"')
  })

  it('fills orange with white "W ulubionych" and a filled heart once saved', () => {
    const html = heart({ initialFavorited: true })
    expect(html).toContain('bg-action text-white')
    expect(html).toContain('<span>W ulubionych</span>')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('gives a guest the same "Zapisz" as a button, with no login link for crawlers to follow', () => {
    const html = heart({ isAuthenticated: false })
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>/)
    expect(html).not.toContain('href=')
    expect(html).toContain('Zapisz<span class="sr-only"> w ulubionych</span>')
  })
})
