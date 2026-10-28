import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipePhotos, photoAlt, photoList } from './recipe-photos'

const COVER = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/c.webp'
const EXTRA = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/2.webp'

function render(images: string[]) {
  return renderToStaticMarkup(
    createElement(RecipePhotos, { cover: COVER, title: 'Zupa krem z dyni', images, badge: createElement('span', null, 'BADGE') }),
  )
}

describe('RecipePhotos (handoff 2026-10-28)', () => {
  it('shows only the main photo and its badge when there is no gallery (a guest)', () => {
    const html = render([])
    expect(html).toContain('class="relative aspect-[4/3]"')
    expect(html).toContain('BADGE')
    expect(html).not.toContain('aria-label="Zdjęcia przepisu"')
  })

  it('lists the cover and the gallery as thumbnails, the first one pressed', () => {
    const html = render([EXTRA])
    expect(html).toContain('aria-label="Zdjęcia przepisu"')
    expect(html).toContain('aria-label="Pokaż zdjęcie 1 z 2"')
    expect(html).toContain('aria-label="Pokaż zdjęcie 2 z 2"')
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Pokaż zdjęcie 1 z 2"/)
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Pokaż zdjęcie 2 z 2"/)
  })

  it('does not repeat the cover when the gallery also holds it', () => {
    const html = render([COVER, EXTRA])
    expect(html).toContain('aria-label="Pokaż zdjęcie 2 z 2"')
    expect(html).not.toContain('aria-label="Pokaż zdjęcie 3 z 3"')
  })

  it('keeps the thumbnails out of the 4:3 box, so the photo keeps its ratio', () => {
    const html = render([EXTRA])
    expect(html.indexOf('aria-label="Zdjęcia przepisu"')).toBeGreaterThan(html.indexOf('class="relative aspect-[4/3]"'))
  })

  it('names the cover after the recipe', () => {
    expect(render([EXTRA])).toContain('alt="Zupa krem z dyni"')
  })
})

describe('photoList', () => {
  it('puts the cover first and lists each URL once', () => {
    expect(photoList(COVER, [EXTRA, COVER, EXTRA])).toEqual([COVER, EXTRA])
  })

  it('is just the cover without a gallery', () => {
    expect(photoList(COVER, [])).toEqual([COVER])
  })
})

describe('photoAlt', () => {
  it('uses the title for the cover and numbers a gallery photo', () => {
    expect(photoAlt('Zupa', 0, 3)).toBe('Zupa')
    expect(photoAlt('Zupa', 2, 3)).toBe('Zupa — zdjęcie 3 z 3')
  })
})
