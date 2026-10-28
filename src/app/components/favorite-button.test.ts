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

  it('sends a guest to log in from the same named heart', () => {
    const html = heart({ size: 'photo', recipeTitle: 'Sernik', isAuthenticated: false })
    expect(html).toMatch(/<a href="\/login\?[^"]*fav=7"[^>]*aria-label="Dodaj do ulubionych: Sernik"/)
  })
})

describe('FavoriteButton on the recipe page', () => {
  it('is the 76 px framed action card (design 2026-10-28)', () => {
    const button = heart({}).match(/<button[^>]*>/)?.[0]
    expect(button).toContain('min-h-[76px]')
    expect(button).toContain('border-border-chip')
  })

  it('keeps its visible label over a hint, and no aria-label', () => {
    const html = heart({})
    expect(html).toMatch(/>Dodaj do ulubionych<\/span><span[^>]*>Zapisz przepis na później<\/span>/)
    expect(html).not.toContain('aria-label')
  })

  it('shows the saved state with an orange frame and a filled heart', () => {
    const html = heart({ initialFavorited: true })
    expect(html).toContain('border-action bg-surface-accent')
    expect(html).toContain('>W ulubionych</span>')
    expect(html).toContain('fill="currentColor"')
  })
})
