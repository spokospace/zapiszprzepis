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
  it('stacks the heart over a Udostępnij/Drukuj pair; the heart sits left from sm', () => {
    // Three content-width buttons do not fit the desktop text column on one line, so the
    // heart keeps its own line and the secondary pair keeps theirs (no wrap/squeeze).
    expect(render()).toMatch(/^<div class="mt-6 flex flex-col gap-3 print:hidden"><div class="flex flex-col sm:items-start"/)
  })

  it('shows "Udostępnij" as a secondary button beside "Drukuj"', () => {
    const html = render()
    const share = html.match(/<button type="button" class="[^"]*">.*?Udostępnij<\/button>/)?.[0] ?? ''
    expect(share).toContain('min-h-[48px]')
    expect(share).toContain('lg:min-h-[58px]')
    // The pair row turns horizontal from sm.
    expect(html).toContain('sm:flex-row')
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
