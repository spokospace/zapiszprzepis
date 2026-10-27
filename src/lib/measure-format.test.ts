import { describe, it, expect } from 'vitest'
import { decimalMixedFractions } from '@/lib/measure-format'

// #535 — a mixed fraction in a household measure reads as a decimal; nothing
// else in the measure changes.
describe('decimalMixedFractions', () => {
  it('turns a mixed fraction into a Polish decimal', () => {
    expect(decimalMixedFractions('2 1/2 szklanki')).toBe('2,5 szklanki')
    expect(decimalMixedFractions('1 3/4 kostki')).toBe('1,75 kostki')
    expect(decimalMixedFractions('1 1/4 szklanki')).toBe('1,25 szklanki')
    expect(decimalMixedFractions('2 2/4 szklanki')).toBe('2,5 szklanki')
  })

  it('handles a mixed fraction written with a fraction glyph', () => {
    expect(decimalMixedFractions('2½ szklanki')).toBe('2,5 szklanki')
    expect(decimalMixedFractions('1 ¾ kostki')).toBe('1,75 kostki')
  })

  it('keeps qualifiers and unit words around it', () => {
    expect(decimalMixedFractions('ok. 1 1/2 szklanki')).toBe('ok. 1,5 szklanki')
    expect(decimalMixedFractions('około 2 1/2 szklanki')).toBe('około 2,5 szklanki')
    expect(decimalMixedFractions('do 1 1/2 łyżki')).toBe('do 1,5 łyżki')
  })

  it('leaves bare fractions, decimals and text alone', () => {
    expect(decimalMixedFractions('3/4 kostki')).toBe('3/4 kostki')
    expect(decimalMixedFractions('do 1/3 szklanki')).toBe('do 1/3 szklanki')
    expect(decimalMixedFractions('około 1,5 szklanki')).toBe('około 1,5 szklanki')
    expect(decimalMixedFractions('2 szklanki')).toBe('2 szklanki')
    expect(decimalMixedFractions('szklanka z czubem')).toBe('szklanka z czubem')
    expect(decimalMixedFractions('½ szklanki')).toBe('½ szklanki')
  })

  it('leaves a mixed fraction alone when the decimal would be long or the fraction improper', () => {
    expect(decimalMixedFractions('1 1/3 szklanki')).toBe('1 1/3 szklanki')
    expect(decimalMixedFractions('1 1/8 szklanki')).toBe('1 1/8 szklanki')
    expect(decimalMixedFractions('1⅓ szklanki')).toBe('1⅓ szklanki')
    expect(decimalMixedFractions('1 3/2 szklanki')).toBe('1 3/2 szklanki')
    expect(decimalMixedFractions('1 0/2 szklanki')).toBe('1 0/2 szklanki')
  })

  it('does not touch a number glued to other digits', () => {
    expect(decimalMixedFractions('1,5 1/2 szklanki')).toBe('1,5 1/2 szklanki')
    expect(decimalMixedFractions('2 1/2/3')).toBe('2 1/2/3')
  })
})
