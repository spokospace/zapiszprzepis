import { describe, it, expect } from 'vitest'
import { dayOfYearUTC, dailyRecipeIndex } from './recipe-of-the-day'

describe('dayOfYearUTC', () => {
  it('counts 1 on Jan 1 and 365/366 at year end', () => {
    expect(dayOfYearUTC(new Date('2026-01-01T12:00:00Z'))).toBe(1)
    expect(dayOfYearUTC(new Date('2026-12-31T00:00:00Z'))).toBe(365)
    expect(dayOfYearUTC(new Date('2028-12-31T00:00:00Z'))).toBe(366) // leap year
  })
})

describe('dailyRecipeIndex', () => {
  it('is 0 for an empty pool', () => {
    expect(dailyRecipeIndex(new Date('2026-10-21T00:00:00Z'), 0)).toBe(0)
  })

  it('stays within [0, count)', () => {
    for (let d = 0; d < 400; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d))
      const i = dailyRecipeIndex(date, 7)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(7)
    }
  })

  it('is deterministic for the same day and the same for everyone', () => {
    const a = dailyRecipeIndex(new Date('2026-10-21T06:00:00Z'), 50)
    const b = dailyRecipeIndex(new Date('2026-10-21T23:30:00Z'), 50)
    expect(a).toBe(b)
  })

  it('moves to a different part of the pool from one day to the next', () => {
    const d1 = dailyRecipeIndex(new Date('2026-10-21T00:00:00Z'), 50)
    const d2 = dailyRecipeIndex(new Date('2026-10-22T00:00:00Z'), 50)
    expect(d1).not.toBe(d2)
    expect(Math.abs(d1 - d2)).not.toBe(1) // ×7 jump, not a neighbouring recipe
  })
})
