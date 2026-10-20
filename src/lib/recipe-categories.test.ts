import { describe, it, expect } from 'vitest'
import { categoryDisplayLabel, CATEGORY_ICONS, categoryLabel, HOME_CATEGORIES, isRecipeCategory, RECIPE_CATEGORIES, toRecipeCategory } from '@/lib/recipe-categories'

describe('CATEGORY_ICONS (E01-S20)', () => {
  it('has an icon for every category', () => {
    for (const { value } of RECIPE_CATEGORIES) expect(CATEGORY_ICONS[value]).toBeTruthy()
  })
})

// recipes.category is a strict enum: whatever the LLM returns must be mapped
// onto it, or the insert fails and the extraction is lost (#134).
describe('toRecipeCategory', () => {
  it.each([
    ['salatki', 'salatki'],
    ['sałatki', 'salatki'],
    ['Sałatki', 'salatki'],
    [' SAŁATKI ', 'salatki'],
    ['Przekąski', 'przekaski'],
    ['Śniadania', 'sniadania'],
  ])('maps %j to %s', (raw, value) => {
    expect(toRecipeCategory(raw)).toEqual({ category: value, coerced: false })
  })

  it.each([['kolacje'], ['wypieki'], [''], [null], [undefined], [42]])('falls back to inne for %j', (raw) => {
    expect(toRecipeCategory(raw)).toEqual({ category: 'inne', coerced: true })
  })
})

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

describe('categoryDisplayLabel', () => {
  it('binds Polish one-letter words so they never end a line', () => {
    expect(categoryDisplayLabel('Syropy i napary')).toBe('Syropy i napary')
  })

  it('leaves a single-word label unchanged', () => {
    expect(categoryDisplayLabel('Ciasteczka')).toBe('Ciasteczka')
  })
})

describe('HOME_CATEGORIES', () => {
  it('is the first 8 categories, in order', () => {
    expect(HOME_CATEGORIES.map((c) => c.value)).toEqual([
      'obiady',
      'zupy',
      'desery',
      'ciasta',
      'ciasteczka',
      'sniadania',
      'pieczywo',
      'przekaski',
    ])
  })

  it('carries display labels with diacritics', () => {
    expect(HOME_CATEGORIES.find((c) => c.value === 'przekaski')?.label).toBe('Przekąski')
  })
})

describe('isRecipeCategory', () => {
  it('accepts every listed value and rejects anything else', () => {
    for (const { value } of RECIPE_CATEGORIES) expect(isRecipeCategory(value)).toBe(true)
    expect(isRecipeCategory('kolacje')).toBe(false)
    expect(isRecipeCategory('Zupy')).toBe(false)
  })
})
