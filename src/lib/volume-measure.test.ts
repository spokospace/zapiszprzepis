import { describe, it, expect } from 'vitest'
import { deriveVolumeMeasure } from '@/lib/volume-measure'

// #505 — deterministic volume → household measure (1 szklanka = 250 ml,
// 1 łyżka = 15 ml, 1 łyżeczka = 5 ml). Exact conversions have no "ok." prefix;
// rounded ones do. Weight is never derived.

describe('deriveVolumeMeasure — szklanki', () => {
  it('converts exact szklanki without an "ok." prefix', () => {
    expect(deriveVolumeMeasure('250', 'ml')).toBe('1 szklanka')
    expect(deriveVolumeMeasure('500', 'ml')).toBe('2 szklanki')
    expect(deriveVolumeMeasure('125', 'ml')).toBe('1/2 szklanki')
    expect(deriveVolumeMeasure('375', 'ml')).toBe('1 1/2 szklanki')
  })

  it('rounds to a friendly fraction with "ok." when inexact', () => {
    expect(deriveVolumeMeasure('180', 'ml')).toBe('ok. 3/4 szklanki') // 0.72 → 3/4
    expect(deriveVolumeMeasure('200', 'ml')).toBe('ok. 3/4 szklanki') // 0.80 → 3/4
  })

  it('uses the right Polish plural for whole szklanki', () => {
    expect(deriveVolumeMeasure('1', 'l')).toBe('4 szklanki') // 1000 ml
    expect(deriveVolumeMeasure('1250', 'ml')).toBe('5 szklanek')
    expect(deriveVolumeMeasure('0,5', 'l')).toBe('2 szklanki') // comma decimal, 500 ml
  })
})

describe('deriveVolumeMeasure — łyżki / łyżeczki', () => {
  it('uses łyżki below a quarter szklanka', () => {
    expect(deriveVolumeMeasure('15', 'ml')).toBe('1 łyżka')
    expect(deriveVolumeMeasure('30', 'ml')).toBe('2 łyżki')
    expect(deriveVolumeMeasure('45', 'ml')).toBe('3 łyżki')
    expect(deriveVolumeMeasure('50', 'ml')).toBe('ok. 3 łyżki')
  })

  it('uses łyżeczki for the smallest amounts', () => {
    expect(deriveVolumeMeasure('5', 'ml')).toBe('1 łyżeczka')
    expect(deriveVolumeMeasure('10', 'ml')).toBe('2 łyżeczki')
  })
})

describe('deriveVolumeMeasure — not derived', () => {
  it('returns null for a non-volume unit (weight is never guessed)', () => {
    expect(deriveVolumeMeasure('300', 'g')).toBeNull()
    expect(deriveVolumeMeasure('150', 'dag')).toBeNull()
    expect(deriveVolumeMeasure('1', 'kg')).toBeNull()
    expect(deriveVolumeMeasure('2', 'szklanki')).toBeNull() // already household
    expect(deriveVolumeMeasure('4', '')).toBeNull()
  })

  it('returns null for an unparseable or non-positive amount', () => {
    expect(deriveVolumeMeasure('200-250', 'ml')).toBeNull()
    expect(deriveVolumeMeasure('trochę', 'ml')).toBeNull()
    expect(deriveVolumeMeasure('0', 'ml')).toBeNull()
    expect(deriveVolumeMeasure(undefined, 'ml')).toBeNull()
    expect(deriveVolumeMeasure('2', ''.trim() || undefined)).toBeNull()
  })

  it('parses fractions and tolerates a trailing-dot unit', () => {
    expect(deriveVolumeMeasure('1/2', 'l')).toBe('2 szklanki') // 500 ml
    expect(deriveVolumeMeasure('250', 'ml.')).toBe('1 szklanka')
  })
})
