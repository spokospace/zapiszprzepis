import { describe, expect, it } from 'vitest'
import { sameIngredients } from './recipe-dedup'

describe('sameIngredients', () => {
  it('ignores order, casing, spacing and repeats', () => {
    expect(sameIngredients([{ name: 'Mąka' }, { name: 'masło' }], [{ name: 'masło ' }, { name: 'mąka' }, { name: 'Masło' }])).toBe(true)
  })

  it('tells apart a variant that adds or swaps an ingredient', () => {
    expect(sameIngredients([{ name: 'mąka' }, { name: 'masło' }], [{ name: 'mąka' }, { name: 'margaryna' }])).toBe(false)
    expect(sameIngredients([{ name: 'mąka' }], [{ name: 'mąka' }, { name: 'cukier' }])).toBe(false)
  })
})
