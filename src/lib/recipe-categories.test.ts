import { describe, it, expect } from 'vitest'
import { categoryLabel, RECIPE_CATEGORIES } from '@/lib/recipe-categories'

// The enum values are ASCII slugs while the labels carry Polish diacritics.
// Rendering the raw value shipped "Salatki"/"Przekaski" to the recipe cards —
// these tests lock the mapping so a display path can't silently regress to it.

describe('categoryLabel', () => {
  it('restores diacritics dropped by the ASCII enum values', () => {
    expect(categoryLabel('salatki')).toBe('Sałatki')
    expect(categoryLabel('przekaski')).toBe('Przekąski')
    expect(categoryLabel('sniadania')).toBe('Śniadania')
  })

  it('maps every declared category to its label', () => {
    for (const { value, label } of RECIPE_CATEGORIES) {
      expect(categoryLabel(value)).toBe(label)
    }
  })

  it('falls back to the raw value for an unknown category', () => {
    // A migration can add an enum member before this table catches up; degrade
    // to something readable rather than blank.
    expect(categoryLabel('kolacje')).toBe('kolacje')
  })

  it('never returns a label that still looks like a raw slug', () => {
    // Guards the inverse mistake: a label pasted in without diacritics.
    expect(RECIPE_CATEGORIES.every(({ value, label }) => label !== value)).toBe(true)
  })
})
