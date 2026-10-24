import { describe, it, expect } from 'vitest'
import { deriveWeightMeasure } from '@/lib/weight-density'

// #510 — deterministic weight → household measure for a curated list of stable
// staples, via grams-per-szklanka densities (szklanka = 250 ml). A weight-derived
// szklanka is always approximate ("ok."); butter (kostka = 200 g) is definitional,
// so an exact weight omits "ok.". A name that matches no staple derives nothing.

describe('deriveWeightMeasure — staples (grams → szklanki)', () => {
  it('derives szklanki for a staple, always with an "ok." prefix', () => {
    expect(deriveWeightMeasure('130', 'g', 'mąki pszennej')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('260', 'g', 'mąka')).toBe('ok. 2 szklanki')
    expect(deriveWeightMeasure('200', 'g', 'cukru')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('80', 'g', 'cukru pudru')).toBe('ok. 1/2 szklanki')
    expect(deriveWeightMeasure('80', 'g', 'płatków owsianych')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('110', 'g', 'kakao')).toBe('ok. 1 szklanka')
  })

  it('matches specific kasza types but not a bare "kasza"', () => {
    expect(deriveWeightMeasure('160', 'g', 'kaszy manny')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('180', 'g', 'kaszy gryczanej')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('170', 'g', 'kaszy jaglanej')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('200', 'g', 'kaszy')).toBeNull() // no type → unsafe → nothing
  })

  it('prefers the specific staple over the generic one (cukier puder before cukier)', () => {
    expect(deriveWeightMeasure('160', 'g', 'cukier puder')).toBe('ok. 1 szklanka') // 160 g/szkl, not 200
  })
})

describe('deriveWeightMeasure — masło (grams → kostki)', () => {
  it('derives kostki, omitting "ok." for an exact (definitional) amount', () => {
    expect(deriveWeightMeasure('200', 'g', 'masła')).toBe('1 kostka')
    expect(deriveWeightMeasure('150', 'g', 'masło')).toBe('3/4 kostki')
    expect(deriveWeightMeasure('100', 'g', 'masła')).toBe('1/2 kostki')
    expect(deriveWeightMeasure('300', 'g', 'masła')).toBe('1 1/2 kostki')
  })

  it('does not treat masło orzechowe (peanut butter) as a block of butter', () => {
    expect(deriveWeightMeasure('200', 'g', 'masła orzechowego')).toBeNull()
  })
})

describe('deriveWeightMeasure — units and normalization', () => {
  it('accepts g, dag/dkg and kg', () => {
    expect(deriveWeightMeasure('13', 'dag', 'mąki')).toBe('ok. 1 szklanka') // 130 g
    expect(deriveWeightMeasure('13', 'dkg', 'mąki')).toBe('ok. 1 szklanka')
    expect(deriveWeightMeasure('0,26', 'kg', 'mąki')).toBe('ok. 2 szklanki') // 260 g, comma decimal
    expect(deriveWeightMeasure('130', 'g.', 'mąki')).toBe('ok. 1 szklanka') // trailing-dot unit
  })

  it('matches across Polish declensions of the staple name', () => {
    expect(deriveWeightMeasure('200', 'g', 'Ryż biały')).toBe('ok. 1 szklanka') // case-insensitive
    expect(deriveWeightMeasure('200', 'g', 'ryżu')).toBe('ok. 1 szklanka')
  })
})

describe('deriveWeightMeasure — not derived', () => {
  it('returns null when the ingredient is not a known staple (better empty than wrong)', () => {
    expect(deriveWeightMeasure('300', 'g', 'startej marchewki')).toBeNull()
    expect(deriveWeightMeasure('50', 'g', 'orzechów włoskich')).toBeNull()
    expect(deriveWeightMeasure('60', 'g', 'mąki ziemniaczanej')).toBeNull() // starch, not wheat flour
  })

  it('returns null for a non-weight unit (volume is handled elsewhere)', () => {
    expect(deriveWeightMeasure('250', 'ml', 'mąki')).toBeNull()
    expect(deriveWeightMeasure('2', 'szklanki', 'mąki')).toBeNull()
  })

  it('returns null for an unparseable/non-positive amount or a missing name', () => {
    expect(deriveWeightMeasure('300-400', 'g', 'mąki')).toBeNull()
    expect(deriveWeightMeasure('0', 'g', 'mąki')).toBeNull()
    expect(deriveWeightMeasure(undefined, 'g', 'mąki')).toBeNull()
    expect(deriveWeightMeasure('130', 'g', undefined)).toBeNull()
  })

  it('returns null for an amount too small to round to a quarter szklanka', () => {
    expect(deriveWeightMeasure('10', 'g', 'cukru')).toBeNull() // 0.05 szklanki → nothing
  })
})
