import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The version cards are the shared RecipeCard, whose heart pulls in server-only
// actions; stub it with a marker that shows where the heart sits and what it was given.
vi.mock('@/app/components/favorite-button', () => ({
  FavoriteButton: ({ recipeId, initialFavorited, isAuthenticated }: { recipeId: number; initialFavorited: boolean; isAuthenticated: boolean }) =>
    createElement('i', {
      'data-heart': String(recipeId),
      'data-favorited': String(initialFavorited),
      'data-auth': String(isAuthenticated),
    }),
}))

import { DishVersionsBar } from './dish-versions-bar'
import { DishVersions } from './dish-versions'
import type { DishVersionRow } from '@/lib/dish-versions'

const row = (p: Partial<DishVersionRow> = {}): DishVersionRow => ({
  id: 1,
  slug: 'sernik-1',
  title: 'Sernik klasyczny',
  image_url: null,
  source_type: 'web_blog',
  source_url: 'https://aniagotuje.pl/x',
  source_author: null,
  variant_note: null,
  servings: null,
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  times_estimated: false,
  ingredients: [],
  created_at: '2026-01-01T00:00:00Z',
  favorites_count: 0,
  total_count: 1,
  ...p,
})

const current = {
  servings: null,
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  times_estimated: false,
  ingredients: [] as unknown,
}

describe('DishVersionsBar', () => {
  it('renders nothing when there are no other versions', () => {
    expect(renderToStaticMarkup(createElement(DishVersionsBar, { count: 0, dishAccusative: 'sernik' }))).toBe('')
  })

  it('links to the section with singular wording and the accusative', () => {
    const html = renderToStaticMarkup(createElement(DishVersionsBar, { count: 1, dishAccusative: 'szarlotkę' }))
    expect(html).toContain('href="#inne-przepisy"')
    expect(html).toContain('Inne przepisy na szarlotkę (1)')
  })

  it('falls back to "na to danie" without an accusative', () => {
    const html = renderToStaticMarkup(createElement(DishVersionsBar, { count: 3, dishAccusative: null }))
    expect(html).toContain('Inne przepisy na to danie (3)')
  })
})

function section(props: Partial<Parameters<typeof DishVersions>[0]>) {
  return renderToStaticMarkup(
    createElement(DishVersions, {
      versions: [],
      totalCount: 0,
      dish: 'sernik',
      favoriteIds: null,
      order: 'popularne',
      current,
      ...props,
    }),
  )
}

describe('DishVersions', () => {
  it('renders nothing with no versions (empty-data state)', () => {
    expect(section({ versions: [], totalCount: 0 })).toBe('')
  })

  it('shows the heading (genitive + N) and the caption (handoff 16)', () => {
    const html = section({ versions: [row()], totalCount: 5, dish: 'pączki' })
    expect(html).toContain('id="inne-przepisy"')
    expect(html).toContain('Inne wersje pączków (5)')
    expect(html).toContain('Czym różnią się od tego przepisu')
    expect(html).not.toContain('przepisu, który oglądasz')
  })

  it('uses the case-free heading for an unknown or missing dish', () => {
    expect(section({ versions: [row()], totalCount: 1, dish: null })).toContain('Inne wersje tego dania (1)')
    expect(section({ versions: [row()], totalCount: 1, dish: 'nieznane' })).toContain('Inne wersje tego dania (1)')
  })

  it('puts a heart on every card, filled for the viewer\'s favorites, login-bound for a guest', () => {
    const rows = [row({ id: 1, slug: 'a' }), row({ id: 2, slug: 'b' })]
    const member = section({ versions: rows, totalCount: 2, favoriteIds: new Set([2]) })
    expect(member).toContain('data-heart="1" data-favorited="false" data-auth="true"')
    expect(member).toContain('data-heart="2" data-favorited="true" data-auth="true"')
    const guest = section({ versions: rows, totalCount: 2, favoriteIds: null })
    expect(guest).toContain('data-heart="1" data-favorited="false" data-auth="false"')
  })

  it('hides the sort control with fewer than two versions', () => {
    expect(section({ versions: [row()], totalCount: 1 })).not.toContain('Kolejność')
  })

  it('shows the sort control and marks the active order with aria-current', () => {
    const html = section({ versions: [row({ id: 1 }), row({ id: 2 })], totalCount: 2, order: 'nowe' })
    expect(html).toContain('Kolejność')
    expect(html).toContain('aria-current="true"')
    expect(html).toContain('✓ Najnowsze')
  })

  it('server-renders the chosen order (newest first for ?wersje=nowe)', () => {
    const older = row({ id: 1, slug: 'stary', title: 'Stary', created_at: '2026-01-01T00:00:00Z' })
    const newer = row({ id: 2, slug: 'nowy', title: 'Nowy', created_at: '2026-05-01T00:00:00Z' })
    const html = section({ versions: [older, newer], totalCount: 2, order: 'nowe' })
    expect(html.indexOf('/przepis/nowy')).toBeLessThan(html.indexOf('/przepis/stary'))
  })

  it('shows the recipe title and the variant note as its subtitle', () => {
    const html = section({
      versions: [row({ variant_note: 'Na zimno', title: 'Sernik truskawkowy' })],
      totalCount: 1,
    })
    expect(html).toContain('Sernik truskawkowy')
    expect(html).toContain('Na zimno')
  })

  it('shows the ingredient difference with labelled "Ma dodatkowo:" / "Nie ma:"', () => {
    const html = section({
      versions: [row({ ingredients: [{ name: 'rodzynki' }] as unknown })],
      totalCount: 1,
    })
    // current has no ingredients, so the version only adds.
    expect(html).toContain('Ma dodatkowo:')
    expect(html).toContain('rodzynki')
  })

  it('sets the differences under a thin rule, cut to two lines, labels coloured (handoff 16)', () => {
    const html = section({
      versions: [row({ ingredients: [{ name: 'rodzynki' }] as unknown })],
      totalCount: 1,
    })
    expect(html).toContain('border-t border-border-card pt-2')
    expect(html).toContain('<p class="line-clamp-2 break-words"><b class="text-[#166534]">Ma dodatkowo:</b>')
    // Colour reinforces the labels (the words still carry the meaning): green adds, red drops.
    expect(html).toContain('text-[#166534]')
  })

  it('shows no rule when a version differs in nothing', () => {
    expect(section({ versions: [row()], totalCount: 1 })).not.toContain('pt-2 text-[16px] leading-[1.4]')
  })
})
