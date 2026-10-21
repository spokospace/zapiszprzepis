import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DishVersionsSort } from './dish-versions-sort'
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

// The island only re-orders server-rendered cards, so a marker node per id stands in.
const cards = { 1: createElement('i', { 'data-card': '1' }), 2: createElement('i', { 'data-card': '2' }) }

const html = renderToStaticMarkup(
  createElement(DishVersionsSort, {
    versions: [row(1), row(2)],
    initialOrder: 'popularne',
    label: 'Inne przepisy na pierogi ruskie (2)',
    cards,
  }),
)

describe('DishVersionsSort', () => {
  it('puts every server-rendered card in the carousel: 270 px on a phone, 2 columns from sm, 3 from lg', () => {
    expect(html.match(/<li class="w-\[270px\] [^"]*"><i data-card/g)).toHaveLength(2)
    expect(html).toMatch(/<ul id="[^"]+" class="[^"]*sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-3/)
  })

  it('names the carousel buttons after the section heading', () => {
    expect(html).toContain('Następne<span class="sr-only">: Inne przepisy na pierogi ruskie (2)</span>')
  })

  it('lets the "Kolejność:" label break a long word instead of widening the page (WCAG 1.4.10)', () => {
    expect(html).toContain('<span id="wersje-kolejnosc" class="mr-1 text-[16px] font-bold wrap-anywhere text-ink-soft">')
  })

  it('keeps the desktop pills, hidden below md (11a)', () => {
    expect(html).toMatch(/role="group" aria-labelledby="wersje-kolejnosc" class="[^"]*hidden[^"]*md:flex/)
  })

  // 11b: below md the three pills wrap awkwardly, so the order is one „Kolejność: …” button
  // that opens a <details> list — working without JS via the same ?wersje= links.
  it('offers a <details> order dropdown below md, showing the current choice (11b)', () => {
    expect(html).toMatch(/<details[^>]*class="[^"]*md:hidden/)
    expect(html).toMatch(/<summary[^>]*>[\s\S]*Kolejność: <\/span>Najpopularniejsze/)
  })

  it('lists every order as a ?wersje= link with the current one marked', () => {
    for (const key of ['popularne', 'nowe', 'szybkie']) {
      expect(html).toContain(`href="?wersje=${key}#inne-przepisy"`)
    }
    // The selected row carries aria-current and the check mark.
    expect(html).toMatch(/aria-current="true"[\s\S]*?Najpopularniejsze<\/span><svg/)
  })
})
