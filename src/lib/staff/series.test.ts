import { describe, it, expect } from 'vitest'
import { addDays, byDay, fillDays } from './series'

describe('fillDays', () => {
  it('lists every day of the range across a month end, zero where nothing was counted', () => {
    expect(fillDays('2026-10-30', '2026-11-02', new Map([['2026-11-01', 3]]))).toEqual([
      { day: '2026-10-30', value: 0 },
      { day: '2026-10-31', value: 0 },
      { day: '2026-11-01', value: 3 },
      { day: '2026-11-02', value: 0 },
    ])
  })

  it('gives nothing for a bad or reversed range', () => {
    expect(fillDays('x', '2026-11-02', new Map())).toEqual([])
    expect(fillDays('2026-11-02', 'x', new Map())).toEqual([])
    expect(fillDays('2026-11-02', '2026-11-01', new Map())).toEqual([])
  })
})

describe('addDays', () => {
  it('moves a day across a year end, and refuses what is not a day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-04', 29)).toBe('2026-11-02')
    expect(addDays('x"; evil', 1)).toBeNull()
  })
})

describe('byDay', () => {
  it('maps rows by day, skipping rows without one', () => {
    expect(byDay([{ day: '2026-11-01', n: 2 }, { day: 5, n: 9 }], (r) => Number(r.n))).toEqual(new Map([['2026-11-01', 2]]))
  })
})
