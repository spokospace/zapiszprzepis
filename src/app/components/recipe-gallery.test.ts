import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeGallery } from './recipe-gallery'

describe('RecipeGallery grid (A9)', () => {
  const html = renderToStaticMarkup(
    createElement(RecipeGallery, { images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'], title: 'Zupa' }),
  )

  it('heads the grid like the recipe page\'s other sections, on tokens', () => {
    expect(html).toContain('<h2 class="mb-4 text-[24px] font-bold text-ink">Zdjęcia</h2>')
    expect(html).not.toMatch(/gray-\d00/)
  })

  it('rounds the thumbnails at 12 px, four a row from lg', () => {
    expect(html).toContain('lg:grid-cols-4')
    expect(html).toMatch(/<button type="button" class="[^"]*rounded-\[12px\] bg-surface-3"[^>]*aria-label="Powiększ zdjęcie 1 z 2"/)
  })
})
