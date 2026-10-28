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
  it('is a 2 × 2 grid from lg: the cooking card first, then the heart, each a full row below lg', () => {
    const html = render()
    expect(html).toMatch(/^<div class="mt-6 mb-8 grid grid-cols-2 items-start[^"]*"><div class="col-span-2 lg:col-span-1"><button/)
    expect(html.indexOf('Włącz tryb gotowania')).toBeLessThan(html.indexOf('Dodaj do ulubionych'))
  })

  it('drops the cooking card when the recipe has no steps; the heart takes the whole row', () => {
    const html = render({ steps: [], stepImages: [] })
    expect(html).not.toContain('tryb gotowania')
    expect(html).toMatch(/^<div class="mt-6 mb-8 grid[^"]*"><div class="col-span-2">/)
  })

  it('labels the cooking card with a hint line', () => {
    const html = render()
    expect(html).toContain('Włącz tryb gotowania')
    expect(html).toContain('Gotuj krok po kroku')
  })

  it('shows "Udostępnij przepis" as a full-width framed card (64 px)', () => {
    const share = render().match(/<button type="button" class="[^"]*">(?:(?!<\/button>).)*Udostępnij przepis<\/button>/)?.[0] ?? ''
    expect(share).toContain('min-h-[64px]')
    expect(share).toContain('w-full')
    expect(share).toContain('border-2')
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
    expect(render()).toMatch(/^<div class="mt-6 mb-8 grid[^"]*print:hidden[^"]*"/)
  })

  // Regression (prod 2026-10-25): the row is a standalone block between the header and
  // „Składniki/Przygotowanie”, so it must carry a bottom margin — without one it sat flush
  // against the content below. The cooking button used to provide that gap from the steps
  // section; after it moved into this row, the gap had to move here too.
  it('keeps a bottom gap to the content below it (mb-8)', () => {
    expect(render()).toMatch(/^<div class="mt-6 mb-8 grid/)
    expect(render({ steps: [], stepImages: [] })).toMatch(/^<div class="mt-6 mb-8 grid/)
  })
})
