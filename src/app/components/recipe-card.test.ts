import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CAROUSEL_SIZES, RecipeCard, TILE_SIZES_1_TO_3 } from './recipe-card'

// The heart pulls in server actions; a marker shows where the card puts it.
vi.mock('./favorite-button', () => ({
  FavoriteButton: ({ size, recipeTitle }: { size: string; recipeTitle: string }) =>
    createElement('i', { 'data-heart': size, 'data-title': recipeTitle }),
}))

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

describe('RecipeCard heart', () => {
  const favorite = { recipeId: 1, favorited: false, isAuthenticated: true }

  it('sits on the photo corner of both variants, with no bar under the card', () => {
    for (const variant of ['list', 'tile'] as const) {
      const html = card({ variant, favorite })
      expect(html).toContain('<div class="absolute top-2 right-2 z-10"><i data-heart="photo" data-title="Sernik"></i></div>')
      expect(html).not.toContain('border-t-2')
    }
  })

  it('keeps a list card title clear of the heart beside it from sm', () => {
    expect(card({ variant: 'list', favorite })).toContain('sm:pr-14')
    expect(card({ variant: 'list' })).not.toContain('sm:pr-14')
  })
})

// An archived cover: only those are optimised, so only they get a srcset and `sizes`.
const ARCHIVED = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/cover.webp'

const imgSizes = (props: Partial<Parameters<typeof RecipeCard>[0]> = {}) =>
  card({ imageUrl: ARCHIVED, ...props }).match(/<img[^>]*\ssizes="([^"]*)"/)?.[1]

describe('RecipeCard image sizes (#253)', () => {
  it('keeps the one-column default when the caller passes none (Moje przepisy)', () => {
    expect(imgSizes()).toBe('(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw')
  })

  it("uses the caller's sizes on a tile", () => {
    expect(imgSizes({ sizes: CAROUSEL_SIZES })).toBe(CAROUSEL_SIZES)
    expect(imgSizes({ sizes: TILE_SIZES_1_TO_3 })).toBe(TILE_SIZES_1_TO_3)
  })

  it('asks for the width a card has on a phone: 3/4 of the strip, or the whole row in Ulubione', () => {
    expect(CAROUSEL_SIZES).toMatch(/, calc\(75vw - 1\.5rem\)$/)
    expect(TILE_SIZES_1_TO_3).toMatch(/, calc\(100vw - 2rem\)$/)
  })

  it('uses rem like the grids, so a larger browser font moves both together', () => {
    for (const sizes of [CAROUSEL_SIZES, TILE_SIZES_1_TO_3]) expect(sizes).not.toMatch(/\dpx/)
  })

  it('gives a list card the full width on a phone and its thumbnail from sm, whatever the caller passes', () => {
    expect(imgSizes({ variant: 'list', sizes: CAROUSEL_SIZES })).toBe('(min-width: 40rem) 6rem, calc(100vw - 2rem)')
    expect(imgSizes({ variant: 'list', thumb: 84 })).toBe('(min-width: 40rem) 84px, calc(100vw - 2rem)')
  })
})
