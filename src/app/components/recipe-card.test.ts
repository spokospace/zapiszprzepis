import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CAROUSEL_CLASS, CAROUSEL_ITEM_CLASS, RecipeCard } from './recipe-card'

// The heart pulls in server actions; these cards render without one.
vi.mock('./favorite-button', () => ({ FavoriteButton: () => null }))

const card = (props: Partial<Parameters<typeof RecipeCard>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(RecipeCard, {
      slug: 'sernik',
      title: 'Sernik',
      category: 'ciasta',
      sourceType: 'web_blog',
      sourceUrl: 'https://aniagotuje.pl/sernik',
      sourceAuthor: null,
      ...props,
    }),
  )

describe('RecipeCard list variant on a phone', () => {
  it('runs the photo across the card, then a thumbnail from sm', () => {
    const html = card({ variant: 'list', thumb: 84 })
    expect(html).toMatch(/class="relative aspect-\[4\/3\] w-full [^"]*sm:h-\[84px\] sm:w-\[84px\]/)
    expect(html).toContain('flex-col')
    expect(html).toContain('sm:flex-row')
  })
})

describe('RecipeCard without a photo', () => {
  it('shows the category icon, hidden from screen readers', () => {
    for (const variant of ['list', 'tile'] as const) {
      const html = card({ variant })
      expect(html).toContain('lucide-cake')
      expect(html).toMatch(/<div aria-hidden="true"[^>]*bg-surface-accent-2[^>]*><svg/)
    }
  })

  it('falls back to the "Inne" icon for a category it does not know', () => {
    expect(card({ variant: 'list', category: 'nieznana' })).toContain('lucide-utensils-crossed')
  })
})

describe('carousel row', () => {
  it('is a snapping strip on a phone and a grid from sm', () => {
    expect(CAROUSEL_CLASS).toMatch(/(^| )overflow-x-auto( |$)/)
    expect(CAROUSEL_CLASS).toContain('snap-x')
    expect(CAROUSEL_CLASS).toContain('sm:grid sm:grid-cols-2')
    expect(CAROUSEL_CLASS).toContain('lg:grid-cols-4')
    expect(CAROUSEL_ITEM_CLASS).toMatch(/^w-3\/4 .*snap-start.*sm:w-auto$/)
  })
})
