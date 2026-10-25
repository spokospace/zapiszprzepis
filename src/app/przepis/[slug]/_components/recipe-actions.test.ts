import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ usePathname: () => '/przepis/zupa-krem-z-dyni' }))
vi.mock('@/app/favorites/actions', () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }))

import { RecipeActions } from './recipe-actions'

const PROPS: Parameters<typeof RecipeActions>[0] = {
  recipeId: 7,
  isFavorite: false,
  isAuthenticated: true,
  title: 'Zupa krem z dyni',
  shareUrl: 'https://zapiszprzepis.pl/przepis/zupa-krem-z-dyni',
}

function render(extra: Partial<Parameters<typeof RecipeActions>[0]> = {}) {
  return renderToStaticMarkup(createElement(RecipeActions, { ...PROPS, ...extra }))
}

describe('RecipeActions (E01-S31 §3)', () => {
  it('stacks below sm so the heart is full width, then a row from sm', () => {
    expect(render()).toMatch(/^<div class="mt-6 flex flex-col gap-3 sm:flex-row[^"]*"><div class="flex flex-col sm:flex-1[^"]*">/)
  })

  it('shows "Udostępnij" beside the heart, each half the row from sm', () => {
    const html = render()
    const share = html.match(/<button type="button" class="[^"]*">.*?Udostępnij<\/button>/)?.[0] ?? ''
    expect(share).toContain('min-h-[48px]')
    expect(share).toContain('lg:min-h-[58px]')
    expect(share).toContain('sm:flex-1')
  })

  it('has no "Oryginał" button — the original is on the photo badge now', () => {
    expect(render()).not.toContain('Oryginał')
  })

  it('offers "Drukuj" after "Udostępnij"', () => {
    const html = render()
    expect(html).toContain('Drukuj')
    // Share first, then print; the button's own look is covered by print-button.test.ts.
    expect(html.indexOf('Drukuj')).toBeGreaterThan(html.indexOf('Udostępnij'))
  })

  it('hides the whole action row on print — none of these controls belongs on paper', () => {
    expect(render()).toMatch(/^<div class="mt-6 flex[^"]*print:hidden"/)
  })
})
