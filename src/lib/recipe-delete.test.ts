import { describe, it, expect } from 'vitest'
import { isRecipeSharedError } from './recipe-delete'

describe('isRecipeSharedError', () => {
  it('recognises the shared-recipe guard', () => {
    expect(isRecipeSharedError({ code: 'P0001', message: 'recipe_shared' })).toBe(true)
  })

  it('ignores other raised exceptions and other errors', () => {
    expect(isRecipeSharedError({ code: 'P0001', message: 'something else' })).toBe(false)
    expect(isRecipeSharedError({ code: '23503', message: 'recipe_shared' })).toBe(false)
    expect(isRecipeSharedError(null)).toBe(false)
    expect(isRecipeSharedError(undefined)).toBe(false)
  })
})
