import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The heart pulls in server actions and Supabase; these cards are rendered without one.
vi.mock('./favorite-button', () => ({ FavoriteButton: () => null }))

import { RecipeCard, TILE_SIZES_2_TO_3, TILE_SIZES_2_TO_4 } from './recipe-card'

// An archived cover: only those are optimised, so only they get a srcset and `sizes`.
const ARCHIVED = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/cover.webp'

function imgSizes(props: { sizes?: string; variant?: 'tile' | 'list' }) {
  const html = renderToStaticMarkup(
    createElement(RecipeCard, {
      slug: 'sernik',
      title: 'Sernik',
      category: 'ciasta',
      sourceType: 'web_blog',
      sourceUrl: 'https://aniagotuje.pl/przepis/sernik',
      sourceAuthor: null,
      imageUrl: ARCHIVED,
      ...props,
    }),
  )
  return html.match(/<img[^>]*\ssizes="([^"]*)"/)?.[1]
}

describe('RecipeCard image sizes (#253)', () => {
  it('keeps the one-column default when the caller passes none (Moje przepisy)', () => {
    expect(imgSizes({})).toBe('(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw')
  })

  it("uses the caller's sizes for a two-column grid", () => {
    expect(imgSizes({ sizes: TILE_SIZES_2_TO_4 })).toBe(TILE_SIZES_2_TO_4)
    expect(imgSizes({ sizes: TILE_SIZES_2_TO_3 })).toBe(TILE_SIZES_2_TO_3)
  })

  it('asks for half the screen on a phone in both two-column grids', () => {
    for (const sizes of [TILE_SIZES_2_TO_4, TILE_SIZES_2_TO_3]) expect(sizes).toMatch(/, 50vw$/)
  })

  it('uses rem like the grids, so a larger browser font moves both together', () => {
    for (const sizes of [TILE_SIZES_2_TO_4, TILE_SIZES_2_TO_3]) expect(sizes).not.toMatch(/\dpx/)
  })

  it("leaves the list card's fixed thumbnail alone", () => {
    expect(imgSizes({ variant: 'list', sizes: TILE_SIZES_2_TO_4 })).toBe('96px')
  })
})
