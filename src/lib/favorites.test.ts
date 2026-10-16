import { describe, it, expect } from 'vitest'
import { parseRecipeId } from './favorites'

describe('parseRecipeId', () => {
  it('accepts positive integers, as numbers or numeric strings', () => {
    expect(parseRecipeId(42)).toBe(42)
    expect(parseRecipeId('42')).toBe(42)
    expect(parseRecipeId(' 7 ')).toBe(7)
  })

  it('rejects everything else', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, '', '  ', 'abc', '1e3x', null, undefined, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseRecipeId(bad)).toBeNull()
    }
  })
})
