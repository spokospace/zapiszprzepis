import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/recipes',
}))
vi.mock('@/app/components/recipe-card', () => ({
  RecipeCard: ({ slug, favorite }: { slug: string; favorite?: { favorited: boolean; isAuthenticated: boolean } }) =>
    createElement('a', { href: `/przepis/${slug}`, 'data-favorited': favorite ? String(favorite.favorited) : 'none' }, slug),
}))

import { RecipesContent } from './recipes-content'

function card(n: number) {
  return {
    id: n,
    slug: `p${n}`,
    title: `P${n}`,
    image_url: null,
    category: 'zupy' as const,
    description: null,
    source_type: 'web_blog' as const,
    source_url: null,
    source_author: null,
    hidden_at: null as string | null,
  }
}

function render(more: { href: string; count: number } | null, total = 30, favoriteIds = new Set<number>(), recipes = [card(1), card(2)]) {
  return renderToStaticMarkup(
    createElement(RecipesContent, {
      recipes,
      favoriteIds,
      showSharedToast: false,
      total,
      listHref: '/recipes?strona=2',
      more,
    }),
  )
}

describe('RecipesContent paging (#230)', () => {
  it('counts every matching recipe, not just the cards shown', () => {
    expect(render(null)).toContain('30 przepisów')
  })

  it('offers „Pokaż kolejne N” that lands on the first new card', () => {
    const html = render({ href: '/recipes?strona=2#wynik-3', count: 24 })
    const link = html.match(/<a[^>]*href="\/recipes\?strona=2#wynik-3"[^>]*>.*?<\/a>/)?.[0] ?? ''
    expect(link.replace(/<!-- -->/g, '')).toMatch(/>Pokaż kolejne 24<\/a>$/)
    expect(html).toContain('id="wynik-1"')
    expect(html).toContain('id="wynik-2"')
  })

  it('has no button once everything is shown', () => {
    expect(render(null, 2)).not.toContain('Pokaż kolejne')
  })
})

describe('RecipesContent favorite heart (#401)', () => {
  it('gives each tile a heart reflecting the owner’s favorited state', () => {
    const html = render(null, 30, new Set([1]))
    const p1 = html.match(/<a[^>]*href="\/przepis\/p1"[^>]*>/)?.[0] ?? ''
    const p2 = html.match(/<a[^>]*href="\/przepis\/p2"[^>]*>/)?.[0] ?? ''
    expect(p1).toContain('data-favorited="true"')
    expect(p2).toContain('data-favorited="false"')
  })

  it('passes the heart to every tile even with no favorites', () => {
    const html = render(null)
    expect(html).not.toContain('data-favorited="none"')
    expect((html.match(/data-favorited="false"/g) ?? []).length).toBe(2)
  })
})

describe('RecipesContent — a recipe staff hid', () => {
  it('shows „Przepis jest niedostępny” instead of the card, with no title and no link', () => {
    const hidden = { ...card(2), title: 'Tajny sernik', hidden_at: '2026-10-29T10:00:00Z' }
    const html = render(null, 2, new Set(), [card(1), hidden])
    expect(html).toContain('Przepis jest niedostępny')
    expect(html).not.toContain('Tajny sernik')
    expect(html).not.toContain('/przepis/p2')
    expect(html).toContain('/przepis/p1')
  })
})
