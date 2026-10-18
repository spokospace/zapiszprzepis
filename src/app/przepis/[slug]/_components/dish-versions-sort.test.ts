import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DishVersionsSort, type CurrentRecipe } from './dish-versions-sort'
import type { DishVersionRow } from '@/lib/dish-versions'

const current: CurrentRecipe = {
  servings: 4,
  prep_time_minutes: 20,
  cook_time_minutes: 40,
  total_time_minutes: 60,
  times_estimated: false,
  ingredients: [],
}

const row = (id: number, image_url: string | null): DishVersionRow => ({
  id,
  slug: `pierogi-${id}`,
  title: `Pierogi ruskie ${id}`,
  image_url,
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

const html = renderToStaticMarkup(
  createElement(DishVersionsSort, {
    // An archived cover: only those are optimised, so only they carry `sizes`.
    versions: [row(1, 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/cover.webp'), row(2, null)],
    initialOrder: 'popularne',
    current,
    label: 'Inne przepisy na pierogi ruskie (2)',
  }),
)

describe('DishVersionsSort on a phone', () => {
  it('puts every version card in the carousel, one wide card a row from sm', () => {
    expect(html.match(/<li class="w-3\/4 [^"]*"><article /g)).toHaveLength(2)
    expect(html).toMatch(/<ul id="[^"]+" class="[^"]*sm:grid-cols-1 sm:gap-6 lg:grid-cols-2/)
  })

  it('names the carousel buttons after the section heading', () => {
    expect(html).toContain('Następne<span class="sr-only">: Inne przepisy na pierogi ruskie (2)</span>')
  })

  it('runs the photo across the card on a phone and keeps the 72 px thumbnail from sm', () => {
    expect(html).toMatch(/class="relative flex aspect-\[4\/3\] w-full [^"]*sm:h-\[72px\] sm:w-\[72px\]"/)
    expect(html).toContain('sizes="(min-width: 40rem) 72px, calc(75vw - 3.5rem)"')
  })

  it('shows a decorative icon in the slot of a version without a photo', () => {
    expect(html).toMatch(/<svg[^>]*lucide-utensils-crossed[^>]*aria-hidden="true"/)
  })
})
