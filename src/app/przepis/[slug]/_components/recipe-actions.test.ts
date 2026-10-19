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
  sourceUrl: 'https://aniagotuje.pl/przepis/zupa',
}

function render(extra: Partial<Parameters<typeof RecipeActions>[0]> = {}) {
  return renderToStaticMarkup(createElement(RecipeActions, { ...PROPS, ...extra }))
}

describe('RecipeActions (C3 phones, A9 desktop)', () => {
  it('stacks below sm so the heart is full width (C3)', () => {
    expect(render()).toMatch(/^<div class="mt-6 flex flex-col gap-3 sm:flex-row[^"]*"><div class="flex flex-col lg:col-span-2">/)
  })

  it('from lg puts the heart across the column and the other two in a row under it', () => {
    expect(render()).toMatch(/^<div class="[^"]*lg:grid lg:grid-cols-2">/)
  })

  it('shows "Udostępnij" at every width, under the heart on phones', () => {
    const html = render()
    const share = html.match(/<button type="button" class="[^"]*">.*?Udostępnij<\/button>/)?.[0] ?? ''
    expect(share).toContain('min-h-[48px]')
    expect(share).toContain('lg:min-h-[58px]')
    // Outside the desktop-only wrapper, right after the heart's.
    expect(html).toMatch(/lg:col-span-2">.*?<\/div><span class="flex flex-col gap-2"><button[^>]*>.*?Udostępnij/)
    expect(html.match(/<div class="hidden lg:contents">.*<\/div>/)?.[0] ?? '').not.toContain('Udostępnij')
  })

  it('adds "Oryginał" from lg only (phones keep the end-of-recipe button)', () => {
    const desktop = render().match(/<div class="hidden lg:contents">.*<\/div>/)?.[0] ?? ''
    expect(desktop).toMatch(/<a href="https:\/\/aniagotuje\.pl\/przepis\/zupa" target="_blank" rel="noopener noreferrer"[^>]*>/)
    expect(desktop).toContain('Oryginał<span class="sr-only"> przepisu (otwiera nową kartę)</span>')
    expect(desktop).toContain('lg:min-h-[58px]')
  })

  it('has no "Oryginał" without a source link', () => {
    expect(render({ sourceUrl: null })).not.toContain('Oryginał')
  })
})
