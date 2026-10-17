import { describe, it, expect } from 'vitest'
import { listCardLines, photosLabel, recipeMetaLine, recipeTotalMinutes } from '@/lib/recipe-meta'

const base = { prep_time_minutes: null, cook_time_minutes: null, total_time_minutes: null }

describe('recipeTotalMinutes', () => {
  it('prefers the stated total', () => {
    expect(recipeTotalMinutes({ prep_time_minutes: 10, cook_time_minutes: 20, total_time_minutes: 45 })).toBe(45)
  })

  it('falls back to prep + cook, with either one alone', () => {
    expect(recipeTotalMinutes({ ...base, prep_time_minutes: 10, cook_time_minutes: 20 })).toBe(30)
    expect(recipeTotalMinutes({ ...base, cook_time_minutes: 20 })).toBe(20)
  })

  it('is null when no time is known', () => {
    expect(recipeTotalMinutes(base)).toBeNull()
  })
})

describe('photosLabel', () => {
  it('uses the right Polish plural form', () => {
    expect(photosLabel(1)).toBe('1 zdjęcie')
    expect(photosLabel(2)).toBe('2 zdjęcia')
    expect(photosLabel(4)).toBe('4 zdjęcia')
    expect(photosLabel(5)).toBe('5 zdjęć')
    expect(photosLabel(12)).toBe('12 zdjęć')
    expect(photosLabel(14)).toBe('14 zdjęć')
    expect(photosLabel(22)).toBe('22 zdjęcia')
    expect(photosLabel(25)).toBe('25 zdjęć')
  })
})

describe('recipeMetaLine', () => {
  it('joins category and time', () => {
    expect(recipeMetaLine({ ...base, total_time_minutes: 70, category: 'ciasta', times_estimated: false })).toBe(
      'Ciasta · 1 godz 10 min',
    )
  })

  it('marks an estimated time', () => {
    expect(recipeMetaLine({ ...base, total_time_minutes: 30, category: 'ciasta', times_estimated: true })).toBe(
      'Ciasta · ≈ 30 min',
    )
  })

  it('shows only the category without a time', () => {
    expect(recipeMetaLine({ ...base, category: 'ciasta', times_estimated: false })).toBe('Ciasta')
  })
})

describe('listCardLines', () => {
  const base = { category: 'zupy', source: 'aniagotuje.pl' }

  it('search/profile: "Kategoria · czas" then the source', () => {
    expect(listCardLines({ ...base, minutes: 45 })).toEqual(['Zupy · 45 min', 'aniagotuje.pl'])
  })

  it('leaves out an unknown or zero time', () => {
    expect(listCardLines({ ...base, minutes: null })).toEqual(['Zupy', 'aniagotuje.pl'])
    expect(listCardLines({ ...base, minutes: 0 })).toEqual(['Zupy', 'aniagotuje.pl'])
  })

  it('in a category: "czas · źródło" then the tags', () => {
    expect(listCardLines({ ...base, minutes: 90, tagLabels: ['kruche', 'maślane'], inCategory: true })).toEqual([
      '1 godz 30 min · aniagotuje.pl',
      'kruche · maślane',
    ])
  })

  it('in a category without time or tags: just the source', () => {
    expect(listCardLines({ ...base, minutes: null, tagLabels: [], inCategory: true })).toEqual(['aniagotuje.pl'])
  })
})
