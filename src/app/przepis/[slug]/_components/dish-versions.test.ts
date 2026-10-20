import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The version cards are the shared RecipeCard, whose heart pulls in server-only
// actions; stub it so the card renders in a test (no heart is passed anyway).
vi.mock('@/app/components/favorite-button', () => ({ FavoriteButton: () => null }))

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
    expect(html).toContain('Mamy jeszcze 1 inny przepis na szarlotkę')
  })

  it('falls back to "na to danie" without an accusative', () => {
    const html = renderToStaticMarkup(createElement(DishVersionsBar, { count: 3, dishAccusative: null }))
    expect(html).toContain('Mamy jeszcze 3 inne przepisy na to danie')
  })
})

function section(props: Partial<Parameters<typeof DishVersions>[0]>) {
  return renderToStaticMarkup(
    createElement(DishVersions, {
      versions: [],
      totalCount: 0,
      dishAccusative: 'sernik',
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

  it('shows the heading (accusative + N) and the caption', () => {
    const html = section({ versions: [row()], totalCount: 1, dishAccusative: 'sernik' })
    expect(html).toContain('id="inne-przepisy"')
    expect(html).toContain('Inne przepisy na sernik (1)')
    expect(html).toContain('Czym różnią się od przepisu')
  })

  it('uses the case-free heading without an accusative', () => {
    expect(section({ versions: [row()], totalCount: 1, dishAccusative: null })).toContain('Inne wersje tego dania (1)')
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
})
