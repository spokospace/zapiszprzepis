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
  steps: ['Zagotuj wodę.', 'Dodaj dynię.'],
  stepImages: ['', ''],
}

function render(extra: Partial<Parameters<typeof RecipeActions>[0]> = {}) {
  return renderToStaticMarkup(createElement(RecipeActions, { ...PROPS, ...extra }))
}

describe('RecipeActions (E01-S31 §3)', () => {
  it('is a 2→4 column grid with steps: heart spans the first row, four equal columns from lg', () => {
    // Full content width below the header; four labelled buttons (incl. Tryb gotowania) on one line from lg.
    expect(render()).toMatch(/^<div class="mt-6 grid grid-cols-2 items-start[^"]*lg:grid-cols-4[^"]*"><div class="col-span-2 lg:col-span-1"/)
  })

  it('drops the cooking button and uses three columns when the recipe has no steps', () => {
    const html = render({ steps: [], stepImages: [] })
    expect(html).toContain('lg:grid-cols-3')
    expect(html).not.toContain('Tryb gotowania')
  })

  it('includes "Tryb gotowania" as an action when the recipe has steps', () => {
    expect(render()).toContain('Tryb gotowania')
  })

  it('shows "Udostępnij" as a full-width secondary button (48px, 58px from lg)', () => {
    const html = render()
    const share = html.match(/<button type="button" class="[^"]*">.*?Udostępnij<\/button>/)?.[0] ?? ''
    expect(share).toContain('min-h-[48px]')
    expect(share).toContain('lg:min-h-[58px]')
    expect(share).toContain('w-full')
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
    expect(render()).toMatch(/^<div class="mt-6 grid[^"]*print:hidden[^"]*"/)
  })
})
