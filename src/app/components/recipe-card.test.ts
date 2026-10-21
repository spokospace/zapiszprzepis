import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CAROUSEL_SIZES, LIST_SIZES, RecipeCard, TILE_SIZES_1_TO_3 } from './recipe-card'

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

describe('RecipeCard source badge', () => {
  it('shows the source on the photo, not a category chip or a source line', () => {
    // A real photo, so the no-photo placeholder (which also uses the accent surface) is absent.
    const html = card({ imageUrl: 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/cover.webp' })
    expect(html).toContain('lucide-globe')
    expect(html).toContain('aniagotuje.pl')
    // No category chip (handoff §1): the old accent pill and category label are gone.
    expect(html).not.toContain('bg-surface-accent-2')
    expect(html).not.toContain('Ciasta')
  })

  it('names the platform and channel for YouTube', () => {
    const html = card({ sourceType: 'youtube', sourceUrl: 'https://youtu.be/x', sourceAuthor: 'Kuchnia Ani' })
    expect(html).toContain('lucide-monitor-play')
    expect(html).toContain('YouTube · Kuchnia Ani')
  })

  it('lets a card click through the badge to the recipe (badge is not a link)', () => {
    expect(card()).toContain('pointer-events-none')
  })
})

describe('RecipeCard subtitle', () => {
  it('shows the description under the title when there is one', () => {
    expect(card({ description: 'z musem jabłkowym' })).toContain('z musem jabłkowym')
  })

  it('renders no empty paragraph without a description', () => {
    expect(card()).not.toContain('<p class="line-clamp-2 text-[16px]')
  })
})

const ARCHIVED_COVER = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/cover.webp'

describe('RecipeCard without a photo', () => {
  it('shows the category icon placeholder, hidden from screen readers', () => {
    expect(card({ imageUrl: null })).toContain('lucide-cake')
    // With a real photo there is no placeholder icon.
    expect(card({ imageUrl: ARCHIVED_COVER })).not.toContain('lucide-cake')
  })

  it('falls back to the "Inne" icon for a category it does not know', () => {
    expect(card({ imageUrl: null, category: 'nieznana' })).toContain('lucide-utensils-crossed')
  })
})

describe('RecipeCard heart', () => {
  const favorite = { recipeId: 1, favorited: false, isAuthenticated: true }

  it('sits in the photo corner, with no bar under the card', () => {
    const html = card({ favorite })
    expect(html).toContain('<div class="absolute top-2 right-2 z-10"><i data-heart="photo" data-title="Sernik"></i></div>')
    expect(html).not.toContain('border-t-2')
  })

  it('renders no heart without the favorite prop', () => {
    expect(card()).not.toContain('data-heart')
  })
})

describe('RecipeCard photo height (handoff §2)', () => {
  it('is taller in a list than in a carousel', () => {
    expect(card()).toContain('h-[210px]')
    expect(card({ photo: 'carousel' })).toContain('h-[170px]')
  })
})

describe('RecipeCard extra content', () => {
  it('renders children under the subtitle (versions row)', () => {
    const html = renderToStaticMarkup(
      createElement(
        RecipeCard,
        {
          slug: 's',
          title: 'T',
          category: 'ciasta',
          sourceType: 'web_blog' as const,
          sourceUrl: null,
          sourceAuthor: null,
        },
        createElement('b', null, 'Ma dodatkowo: masło'),
      ),
    )
    expect(html).toContain('Ma dodatkowo: masło')
  })
})

// An archived cover: only those are optimised, so only they get a srcset and `sizes`.
const ARCHIVED = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/cover.webp'

const imgSizes = (props: Partial<Parameters<typeof RecipeCard>[0]> = {}) =>
  card({ imageUrl: ARCHIVED, ...props }).match(/<img[^>]*\ssizes="([^"]*)"/)?.[1]

describe('RecipeCard image sizes (#253)', () => {
  it('defaults to the list grid widths', () => {
    expect(imgSizes()).toBe(LIST_SIZES)
  })

  it("uses the caller's sizes when passed (carousels, Ulubione)", () => {
    expect(imgSizes({ sizes: CAROUSEL_SIZES })).toBe(CAROUSEL_SIZES)
    expect(imgSizes({ sizes: TILE_SIZES_1_TO_3 })).toBe(TILE_SIZES_1_TO_3)
  })

  it('uses rem like the grids, so a larger browser font moves both together', () => {
    for (const sizes of [CAROUSEL_SIZES, TILE_SIZES_1_TO_3, LIST_SIZES]) expect(sizes).not.toMatch(/\dpx/)
  })
})

describe('RecipeCard photo is decorative (WCAG 1.1.1, #410)', () => {
  it('renders an empty alt and keeps the photo out of the a11y tree', () => {
    // The visible title names the card's link, so the dish photo adds no information a
    // name-only alt would not duplicate: empty alt + aria-hidden is the decorative choice.
    const img = card({ imageUrl: ARCHIVED_COVER }).match(/<img[^>]*>/)?.[0] ?? ''
    expect(img).toContain('alt=""')
    expect(img).toContain('aria-hidden="true"')
  })
})

describe('RecipeCard look (style 1b)', () => {
  it('has no frame or background: just a 4 px photo with the text below', () => {
    const html = card()
    expect(html).toContain('rounded-tile')
    expect(html).not.toContain('border-2')
    expect(html).not.toContain('rounded-card')
    expect(html).not.toContain('group-hover:scale-105')
  })

  it('pins the source tab to the photo corner without a shadow', () => {
    const html = card()
    expect(html).toContain('bottom-1.5 left-px')
    expect(html).not.toContain('shadow-sm')
  })
})
