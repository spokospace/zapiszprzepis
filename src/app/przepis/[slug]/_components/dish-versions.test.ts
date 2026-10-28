import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The rows' heart pulls in server-only actions; stub it with a marker that shows where the
// heart sits and what it was given.
vi.mock('@/app/components/favorite-button', () => ({
  FavoriteButton: ({ recipeId, initialFavorited, isAuthenticated }: { recipeId: number; initialFavorited: boolean; isAuthenticated: boolean }) =>
    createElement('i', {
      'data-heart': String(recipeId),
      'data-favorited': String(initialFavorited),
      'data-auth': String(isAuthenticated),
    }),
}))

import { DishVersionsBar, versionsBoxLabel } from './dish-versions-bar'
import { DishVersions, splitHeadingCount } from './dish-versions'
import { showAllLabel } from './dish-versions-sort'
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

describe('DishVersionsBar (handoff 2026-10-28 §3 item 7)', () => {
  const THUMB = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/a.webp'

  it('renders nothing when there are no other versions', () => {
    expect(renderToStaticMarkup(createElement(DishVersionsBar, { count: 0 }))).toBe('')
  })

  it('is one framed link to the section, the title underlined', () => {
    const html = renderToStaticMarkup(createElement(DishVersionsBar, { count: 9 }))
    expect(html).toMatch(/^<a href="#inne-przepisy" class="[^"]*border border-border-card[^"]*"/)
    expect(html).toContain('<span class="block text-[17px] font-bold underline wrap-anywhere">9 innych wersji tego dania</span>')
  })

  it('shows up to the given thumbnails, decorative, overlapping after the first', () => {
    const html = renderToStaticMarkup(createElement(DishVersionsBar, { count: 3, thumbs: [THUMB, `${THUMB}?2`] }))
    expect(html.match(/<img/g)).toHaveLength(2)
    expect(html).toContain('alt=""')
    expect(html.match(/-ml-3/g)).toHaveLength(1)
  })

  it('lists example differences, or no line without any', () => {
    const withNotes = renderToStaticMarkup(createElement(DishVersionsBar, { count: 2, examples: ['Bez drożdży', 'Z serem'] }))
    // Stored sentence-case, shown mid-sentence in lower case.
    expect(withNotes).toContain('np. bez drożdży, z serem')
    expect(renderToStaticMarkup(createElement(DishVersionsBar, { count: 2 }))).not.toContain('np.')
  })
})

describe('versionsBoxLabel', () => {
  it('uses the Polish plural', () => {
    expect(versionsBoxLabel(1)).toBe('1 inna wersja tego dania')
    expect(versionsBoxLabel(3)).toBe('3 inne wersje tego dania')
    expect(versionsBoxLabel(9)).toBe('9 innych wersji tego dania')
    expect(versionsBoxLabel(22)).toBe('22 inne wersje tego dania')
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

describe('DishVersions (handoff 2026-10-28 §6)', () => {
  it('renders nothing with no versions (empty-data state)', () => {
    expect(section({ versions: [], totalCount: 0 })).toBe('')
  })

  it('shows the heading with the count in the accent colour, and the caption', () => {
    const html = section({ versions: [row()], totalCount: 5, dish: 'pączki' })
    expect(html).toContain('id="inne-przepisy"')
    expect(html).toContain('Inne wersje pączków <span class="text-action-text">(5)</span>')
    expect(html).toContain('Porównane z tym przepisem: co dochodzi, czego brakuje i ile dłużej trwa.')
  })

  it('uses the case-free heading for an unknown or missing dish', () => {
    expect(section({ versions: [row()], totalCount: 1, dish: null })).toContain('Inne wersje tego dania <span class="text-action-text">(1)</span>')
  })

  it('clears the sticky app header when the box jumps to the heading', () => {
    expect(section({ versions: [row()], totalCount: 1 })).toMatch(/id="inne-przepisy"[^>]*class="[^"]*scroll-mt-36[^"]*lg:scroll-mt-40/)
  })

  it('puts a heart on every row, filled for the viewer\'s favorites, login-bound for a guest', () => {
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

  it('shows the segmented switch and marks the active order with aria-current', () => {
    const html = section({ versions: [row({ id: 1 }), row({ id: 2 })], totalCount: 2, order: 'nowe' })
    expect(html).toContain('Kolejność')
    expect(html).toMatch(/aria-current="true"[^>]*>Najnowsze</)
    expect(html).toContain('rounded-pill bg-[#f3f4f6]')
  })

  it('server-renders the chosen order (newest first for ?wersje=nowe)', () => {
    const older = row({ id: 1, slug: 'stary', title: 'Stary', created_at: '2026-01-01T00:00:00Z' })
    const newer = row({ id: 2, slug: 'nowy', title: 'Nowy', created_at: '2026-05-01T00:00:00Z' })
    const html = section({ versions: [older, newer], totalCount: 2, order: 'nowe' })
    expect(html.indexOf('/przepis/nowy')).toBeLessThan(html.indexOf('/przepis/stary'))
  })

  it('shows the linked title and "podpis · źródło"', () => {
    const html = section({ versions: [row({ variant_note: 'Na zimno', title: 'Sernik truskawkowy' })], totalCount: 1 })
    expect(html).toMatch(/<h3[^>]*><a[^>]*href="\/przepis\/sernik-1"[^>]*>Sernik truskawkowy<\/a><\/h3>/)
    expect(html).toContain('Na zimno · aniagotuje.pl')
  })

  it('shows the differences as chips with a hidden prefix for screen readers', () => {
    const html = section({ versions: [row({ ingredients: [{ name: 'rodzynki' }] as unknown })], totalCount: 1 })
    // current has no ingredients, so the version only adds.
    expect(html).toContain('<span class="sr-only">ma dodatkowo: </span><span aria-hidden="true">+ </span>rodzynki')
    expect(html).toContain('bg-[#dcfce7] text-[#14532d]')
  })

  it('strikes what a version lacks, with its own hidden prefix', () => {
    const html = section({
      versions: [row({ ingredients: [] as unknown })],
      totalCount: 1,
      current: { ...current, ingredients: [{ name: 'sezam' }] as unknown },
    })
    expect(html).toMatch(/<li class="[^"]*line-through[^"]*"><span class="sr-only">nie ma: <\/span>sezam<\/li>/)
  })

  it('shows no chip list when a version differs in nothing', () => {
    expect(section({ versions: [row()], totalCount: 1 })).not.toContain('Różnice w składnikach')
  })

  it('shows the time and how much longer the version takes', () => {
    const html = section({
      versions: [row({ total_time_minutes: 180 })],
      totalCount: 1,
      current: { ...current, total_time_minutes: 20 },
    })
    expect(html).toContain('3 godz')
    expect(html).toContain('o 2 godz 40 min dłużej')
  })

  it('renders every row on the server, so the list works without JS', () => {
    const rows = Array.from({ length: 6 }, (_, i) => row({ id: i + 1, slug: `s-${i}` }))
    const html = section({ versions: rows, totalCount: 6 })
    expect(html.match(/<li(?: class="hidden")?><div class="border-t/g)).toHaveLength(6)
    expect(html).not.toContain('class="hidden"><div class="border-t')
    expect(html).not.toContain('Pokaż wszystkie')
  })
})

describe('splitHeadingCount', () => {
  it('splits off the count in brackets', () => {
    expect(splitHeadingCount('Inne wersje pączków (5)')).toEqual(['Inne wersje pączków', '5'])
    expect(splitHeadingCount('Inne wersje')).toEqual(['Inne wersje', null])
  })
})

describe('showAllLabel', () => {
  it('uses the Polish plural', () => {
    expect(showAllLabel(9)).toBe('Pokaż wszystkie 9 wersji')
    expect(showAllLabel(22)).toBe('Pokaż wszystkie 22 wersje')
  })
})
