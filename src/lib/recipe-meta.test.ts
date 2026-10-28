import { describe, it, expect } from 'vitest'
import { photosLabel, recipeTimeStats, recipeTotalMinutes } from '@/lib/recipe-meta'

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

describe('recipeTimeStats (A9 desktop times row)', () => {
  it('lists prep, cook and the stated total', () => {
    expect(recipeTimeStats({ prep_time_minutes: 15, cook_time_minutes: 30, total_time_minutes: 45 })).toEqual([
      { label: 'Przygotowanie', value: '15 min' },
      { label: 'Gotowanie', value: '30 min' },
      { label: 'Łącznie', value: '45 min' },
    ])
  })

  it('sums prep + cook into "Łącznie" when no total is stated', () => {
    expect(recipeTimeStats({ ...base, prep_time_minutes: 20, cook_time_minutes: 70 }).at(-1)).toEqual({
      label: 'Łącznie',
      value: '1 godz 30 min',
    })
  })

  it('does not repeat a lone part as "Łącznie"', () => {
    expect(recipeTimeStats({ ...base, cook_time_minutes: 40 })).toEqual([{ label: 'Gotowanie', value: '40 min' }])
  })

  it('shows a stated total alone', () => {
    expect(recipeTimeStats({ ...base, total_time_minutes: 60 })).toEqual([{ label: 'Łącznie', value: '1 godz' }])
  })

  it('skips unknown and zero times', () => {
    expect(recipeTimeStats(base)).toEqual([])
    expect(recipeTimeStats({ prep_time_minutes: 0, cook_time_minutes: null, total_time_minutes: 0 })).toEqual([])
  })
})

