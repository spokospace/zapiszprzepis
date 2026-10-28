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

describe('RecipeActions (handoff 2026-10-28)', () => {
  it('puts "Zacznij gotować" beside the heart in the first row, the cooking part twice as wide', () => {
    const html = render()
    expect(html).toMatch(/^<div class="mt-6 flex flex-col gap-3 print:hidden"><div class="flex flex-col gap-3 min-\[480px\]:flex-row"><div class="min-w-0 flex-\[2\]">/)
    expect(html.indexOf('Zacznij gotować')).toBeLessThan(html.indexOf('Dodaj do ulubionych'))
  })

  it('drops the cooking button when the recipe has no steps; the heart takes the whole row', () => {
    const html = render({ steps: [], stepImages: [] })
    expect(html).not.toContain('Zacznij gotować')
    expect(html).not.toContain('flex-[2]')
    expect(html).toMatch(/<div class="flex flex-col gap-3 min-\[480px\]:flex-row"><div class="w-full">/)
  })

  it('labels the cooking button without the old hint line', () => {
    const html = render()
    expect(html).toContain('<span>Zacznij gotować</span>')
    expect(html).not.toContain('Gotuj krok po kroku')
  })

  it('shows "Udostępnij przepis" in the second row', () => {
    expect(render()).toContain('Udostępnij przepis')
  })

  it('has no "Oryginał" button — the original is on the photo badge now', () => {
    expect(render()).not.toContain('Oryginał')
  })

  it('offers "Wydrukuj przepis" before "Udostępnij przepis"', () => {
    const html = render()
    expect(html).toContain('Wydrukuj przepis')
    expect(html.indexOf('Wydrukuj przepis')).toBeLessThan(html.indexOf('Udostępnij przepis'))
  })

  it('hides the whole action block on print — none of these controls belongs on paper', () => {
    expect(render()).toMatch(/^<div class="mt-6 flex flex-col gap-3 print:hidden">/)
  })

  // The gap to „Składniki” below is the header's mb-8 now that the actions sit inside it
  // (recipe-header.test.ts); a margin here would stack on top of it.
  it('carries no bottom margin of its own', () => {
    expect(render()).not.toMatch(/^<div class="[^"]*mb-/)
  })
})
