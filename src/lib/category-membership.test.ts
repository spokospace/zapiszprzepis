import { describe, expect, it } from 'vitest'
import { inCategory, MAX_EXTRA_CATEGORIES, rowCategories, whereInCategory } from './category-membership'

describe('inCategory', () => {
  it('is true for the primary and for each extra category', () => {
    const row = { category: 'przekaski', extra_categories: ['sniadania', 'salatki'] }
    expect(inCategory(row, 'przekaski')).toBe(true)
    expect(inCategory(row, 'sniadania')).toBe(true)
    expect(inCategory(row, 'salatki')).toBe(true)
    expect(inCategory(row, 'zupy')).toBe(false)
  })

  it('works before the migration (no extra_categories on the row)', () => {
    expect(inCategory({ category: 'zupy' }, 'zupy')).toBe(true)
    expect(inCategory({ category: 'zupy', extra_categories: null }, 'obiady')).toBe(false)
  })
})

describe('rowCategories', () => {
  it('lists the primary first, then the extras, without repeats or nulls', () => {
    expect(rowCategories({ category: 'przekaski', extra_categories: ['sniadania', 'przekaski'] })).toEqual(['przekaski', 'sniadania'])
    expect(rowCategories({ category: null, extra_categories: ['zupy'] })).toEqual(['zupy'])
    expect(rowCategories({ category: 'zupy' })).toEqual(['zupy'])
  })
})

describe('whereInCategory', () => {
  const recorder = () => {
    const filters: string[] = []
    const q = {
      or(f: string) {
        filters.push(f)
        return q
      },
    }
    return { q, filters }
  }

  it('asks for the primary OR an extra category', () => {
    const { q, filters } = recorder()
    whereInCategory(q, 'sniadania')
    expect(filters).toEqual(['category.eq.sniadania,extra_categories.cs.{sniadania}'])
  })

  it('never interpolates a value that is not a category slug', () => {
    const { q, filters } = recorder()
    whereInCategory(q, 'x,id.gt.0')
    expect(filters).toEqual(['id.lt.0'])
  })

  it('caps the extras at two', () => {
    expect(MAX_EXTRA_CATEGORIES).toBe(2)
  })
})
