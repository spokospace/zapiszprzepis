import { describe, it, expect } from 'vitest'
import { toIngredients, toMinutes } from './extracted-recipe'

describe('toIngredients (#381)', () => {
  it('keeps well-formed ingredients as they are', () => {
    expect(toIngredients([{ name: 'Mąka', amount: '200', unit: 'g', section: 'Ciasto' }])).toEqual([
      { name: 'Mąka', amount: '200', unit: 'g', section: 'Ciasto' },
    ])
  })

  it('drops entries without a non-empty string name', () => {
    const raw = [{ amount: '2' }, { name: '' }, { name: '   ' }, { name: 5 }, null, 'mąka', ['Mąka'], { name: 'Jajka' }]
    expect(toIngredients(raw).map((i) => i.name)).toEqual(['Jajka'])
  })

  it('turns a numeric amount into text and anything else into an empty string', () => {
    expect(toIngredients([{ name: 'Mąka', amount: 200, unit: null, section: { x: 1 } }])).toEqual([
      { name: 'Mąka', amount: '200', unit: '', section: '' },
    ])
  })

  it('returns an empty list for anything that is not a list', () => {
    expect(toIngredients(undefined)).toEqual([])
    expect(toIngredients(null)).toEqual([])
    expect(toIngredients({ name: 'Mąka' })).toEqual([])
  })
})

describe('toMinutes (#381)', () => {
  it('keeps a whole number of minutes from 0 to 10000, as a number or a bare numeric string', () => {
    expect(toMinutes(0)).toBe(0)
    expect(toMinutes(45)).toBe(45)
    expect(toMinutes(10_000)).toBe(10_000)
    expect(toMinutes(' 30 ')).toBe(30)
  })

  it('is null for anything the int column cannot take', () => {
    for (const value of ['15-20', 37.5, -5, 10_001, 'około 20', '', NaN, Infinity, true, {}, undefined, null]) {
      expect(toMinutes(value)).toBeNull()
    }
  })
})
