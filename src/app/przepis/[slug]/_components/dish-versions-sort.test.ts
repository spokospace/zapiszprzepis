import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DishVersionsSort, VERSIONS_SHOWN } from './dish-versions-sort'
import type { DishVersionRow } from '@/lib/dish-versions'

const row = (id: number): DishVersionRow => ({
  id,
  slug: `pierogi-${id}`,
  title: `Pierogi ruskie ${id}`,
  image_url: null,
  source_type: 'web_blog',
  source_url: 'https://aniagotuje.pl/pierogi',
  source_author: null,
  variant_note: null,
  servings: 4,
  prep_time_minutes: 20,
  cook_time_minutes: 40,
  total_time_minutes: 60,
  times_estimated: false,
  ingredients: [],
  created_at: `2026-10-0${id}T00:00:00Z`,
  favorites_count: 0,
  total_count: 2,
})

// The island only re-orders server-rendered rows, so a marker node per id stands in.
function render(count: number) {
  const versions = Array.from({ length: count }, (_, i) => row(i + 1))
  const rows = Object.fromEntries(versions.map((v) => [v.id, createElement('i', { 'data-row': String(v.id) })]))
  return renderToStaticMarkup(
    createElement(DishVersionsSort, {
      versions,
      initialOrder: 'popularne',
      rows,
      header: createElement('h2', { id: 'inne-przepisy' }, 'Inne wersje'),
      legend: createElement('p', { 'data-legend': '' }),
    }),
  )
}

const html = render(2)

describe('DishVersionsSort (handoff 2026-10-28 §6)', () => {
  it('lists every server-rendered row, in order, after the legend', () => {
    expect(html.match(/<li><i data-row/g)).toHaveLength(2)
    expect(html.indexOf('data-legend')).toBeLessThan(html.indexOf('data-row'))
  })

  it('puts the segmented switch beside the heading from md, hidden below', () => {
    expect(html).toMatch(/<div class="flex flex-wrap items-start justify-between[^"]*"><h2 id="inne-przepisy">/)
    expect(html).toMatch(/role="group" aria-labelledby="wersje-kolejnosc" class="hidden md:block"/)
    expect(html).toContain('<span id="wersje-kolejnosc" class="sr-only">Kolejność</span>')
  })

  it('gives every switch option a 48 px target', () => {
    const options = html.match(/<a href="\?wersje=[^"]+"[^>]*class="inline-flex min-h-12[^"]*"/g) ?? []
    expect(options).toHaveLength(3)
  })

  // 11b: below md the three options do not fit, so the order is one „Kolejność: …” button
  // that opens a <details> list — working without JS via the same ?wersje= links.
  it('offers a <details> order dropdown below md, showing the current choice (11b)', () => {
    expect(html).toMatch(/<details[^>]*class="[^"]*md:hidden/)
    expect(html).toMatch(/<summary[^>]*>[\s\S]*Kolejność: <\/span>Najpopularniejsze/)
  })

  it('lists every order as a ?wersje= link with the current one marked', () => {
    for (const key of ['popularne', 'nowe', 'szybkie']) {
      expect(html).toContain(`href="?wersje=${key}#inne-przepisy"`)
    }
    expect(html).toMatch(/aria-current="true"[\s\S]*?Najpopularniejsze<\/span><svg/)
  })

  it('shows every row on the server and no „Pokaż wszystkie” until hydration', () => {
    const many = render(VERSIONS_SHOWN + 2)
    expect(many.match(/<li><i data-row/g)).toHaveLength(VERSIONS_SHOWN + 2)
    expect(many).not.toContain('Pokaż wszystkie')
  })
})
