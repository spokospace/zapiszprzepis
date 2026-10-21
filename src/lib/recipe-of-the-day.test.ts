import { describe, it, expect } from 'vitest'
import { dayOfYearWarsaw, dailyRecipeIndex } from './recipe-of-the-day'

describe('dayOfYearWarsaw', () => {
  it('counts 1 on Jan 1 and 365/366 at year end', () => {
    expect(dayOfYearWarsaw(new Date('2026-01-01T12:00:00Z'))).toBe(1)
    expect(dayOfYearWarsaw(new Date('2026-12-31T00:00:00Z'))).toBe(365)
    expect(dayOfYearWarsaw(new Date('2028-12-31T00:00:00Z'))).toBe(366) // leap year
  })

  it('counts the day in Polish local time, not UTC', () => {
    // 22:00 UTC in summer (CEST, UTC+2) is already midnight in Warsaw → next day.
    expect(dayOfYearWarsaw(new Date('2026-07-15T21:59:00Z'))).toBe(196) // 23:59 Warsaw, Jul 15
    expect(dayOfYearWarsaw(new Date('2026-07-15T22:00:00Z'))).toBe(197) // 00:00 Warsaw, Jul 16
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

  it('is deterministic across a Polish day and the same for everyone', () => {
    const a = dailyRecipeIndex(new Date('2026-07-15T06:00:00Z'), 50) // 08:00 Warsaw, Jul 15
    const b = dailyRecipeIndex(new Date('2026-07-15T20:00:00Z'), 50) // 22:00 Warsaw, Jul 15
    expect(a).toBe(b)
  })

  it('flips at Polish midnight in summer (CEST, UTC+2), not at 00:00 UTC', () => {
    const before = dailyRecipeIndex(new Date('2026-07-15T21:59:00Z'), 50) // 23:59 Warsaw, Jul 15
    const after = dailyRecipeIndex(new Date('2026-07-15T22:00:00Z'), 50) // 00:00 Warsaw, Jul 16
    expect(before).not.toBe(after)
  })

  it('flips at Polish midnight in winter (CET, UTC+1), not at 00:00 UTC', () => {
    const before = dailyRecipeIndex(new Date('2026-01-15T22:59:00Z'), 50) // 23:59 Warsaw, Jan 15
    const after = dailyRecipeIndex(new Date('2026-01-15T23:00:00Z'), 50) // 00:00 Warsaw, Jan 16
    expect(before).not.toBe(after)
  })

  it('does not flip at 00:00 UTC inside a Polish day', () => {
    const before = dailyRecipeIndex(new Date('2026-07-15T23:59:00Z'), 50) // 01:59 Warsaw, Jul 16
    const after = dailyRecipeIndex(new Date('2026-07-16T00:00:00Z'), 50) // 02:00 Warsaw, Jul 16
    expect(before).toBe(after)
  })

  it('moves to a different part of the pool from one day to the next', () => {
    const d1 = dailyRecipeIndex(new Date('2026-10-21T00:00:00Z'), 50)
    const d2 = dailyRecipeIndex(new Date('2026-10-22T00:00:00Z'), 50)
    expect(d1).not.toBe(d2)
    expect(Math.abs(d1 - d2)).not.toBe(1) // ×7 jump, not a neighbouring recipe
  })
})
