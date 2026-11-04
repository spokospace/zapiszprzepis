import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { axisDays, DailyBars, ShareBar } from './charts'

const days = (values: number[]) =>
  values.map((value, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, value }))

describe('axisDays', () => {
  it('labels every day of a week on a wide screen, and the first, middle and last on a phone', () => {
    expect(axisDays(7)).toEqual({ narrow: [0, 3, 6], wide: [0, 1, 2, 3, 4, 5, 6] })
  })

  it('labels about six days of a month, always the last, never two crowded at the end', () => {
    const { narrow, wide } = axisDays(30)
    expect(narrow).toEqual([0, 14, 29])
    expect(wide.at(-1)).toBe(29)
    expect(wide.length).toBeLessThanOrEqual(7)
    expect(wide.at(-1)! - wide.at(-2)!).toBeGreaterThanOrEqual(5)
  })

  it('handles a one-day window', () => {
    expect(axisDays(1)).toEqual({ narrow: [0], wide: [0] })
  })
})

describe('DailyBars', () => {
  it('draws a bar per counted day and states the total and the busiest day', () => {
    const html = renderToStaticMarkup(DailyBars({ title: 'Odsłony', data: days([0, 4, 2]), unit: 'odsłon' }))
    expect(html.match(/class="fill-action"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="Odsłony: razem 6 odsłon, najwięcej 4 (2 paź 2026).')
    expect(html).toContain('Liczby dzień po dniu')
  })

  it('says so when nothing was counted, and renders nothing without days', () => {
    expect(renderToStaticMarkup(DailyBars({ title: 'Odsłony', data: days([0, 0]), unit: 'odsłon' }))).toContain(
      'Odsłony: brak w tym okresie.',
    )
    expect(DailyBars({ title: 'Odsłony', data: [], unit: 'odsłon' })).toBeNull()
  })
})

describe('ShareBar', () => {
  it('is as long as its share of the largest row, and absent for zero', () => {
    expect(renderToStaticMarkup(ShareBar({ value: 5, max: 10 }))).toContain('width:50%')
    expect(ShareBar({ value: 0, max: 10 })).toBeNull()
  })
})
