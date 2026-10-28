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

describe('RecipeActions (E01-S31 §3, design 2026-10-28)', () => {
  it('is one row of four between lg and xl and a 2 × 2 grid from xl, the cooking card first', () => {
    const html = render()
    expect(html).toMatch(/^<div class="mt-6 grid grid-cols-2 items-start[^"]*xl:grid-cols-2[^"]*lg:grid-cols-4"><div class="col-span-2 lg:col-span-1"><button/)
    expect(html.indexOf('Tryb gotowania')).toBeLessThan(html.indexOf('Dodaj do ulubionych'))
  })

  it('drops the cooking card when the recipe has no steps; three in a row, the heart a full row from xl', () => {
    const html = render({ steps: [], stepImages: [] })
    expect(html).not.toContain('Tryb gotowania')
    expect(html).toMatch(/^<div class="[^"]*lg:grid-cols-3"><div class="col-span-2 lg:col-span-1 xl:col-span-2">/)
  })

  it('labels the cooking card with a hint line', () => {
    const html = render()
    expect(html).toContain('Tryb gotowania')
    expect(html).toContain('Gotuj krok po kroku')
  })

  it('shows "Udostępnij przepis" as a full-width framed card (64 px)', () => {
    const share = render().match(/<button type="button" class="[^"]*">(?:(?!<\/button>).)*Udostępnij przepis(?:(?!<\/button>).)*<\/button>/)?.[0] ?? ''
    expect(share).toContain('min-h-[64px]')
    expect(share).toContain('w-full')
    expect(share).toContain('border-2')
    // One-row layout (lg–xl): the short label instead.
    expect(share).toContain('<span class="hidden lg:max-xl:inline">Udostępnij</span>')
  })

  it('has no "Oryginał" button — the original is on the photo badge now', () => {
    expect(render()).not.toContain('Oryginał')
  })

  it('offers "Wydrukuj przepis" before "Udostępnij przepis"', () => {
    const html = render()
    expect(html).toContain('Wydrukuj przepis')
    expect(html.indexOf('Wydrukuj przepis')).toBeLessThan(html.indexOf('Udostępnij przepis'))
  })

  it('hides the whole action row on print — none of these controls belongs on paper', () => {
    expect(render()).toMatch(/^<div class="mt-6 grid[^"]*print:hidden[^"]*"/)
  })

  // The gap to „Składniki” below is the header's mb-8 now that the cards sit inside it
  // (recipe-header.test.ts); a margin here would stack on top of it.
  it('carries no bottom margin of its own', () => {
    expect(render()).not.toMatch(/^<div class="[^"]*mb-/)
  })
})
