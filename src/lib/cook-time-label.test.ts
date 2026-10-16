import { describe, it, expect } from 'vitest'
import { cookTimeLabel } from '@/lib/cook-time-label'

describe('cookTimeLabel', () => {
  it.each([
    ['Piekłam w nagrzanym piekarnku do 190 st ok 20 minut.'],
    ['Wstawić do piekarnika na 40 minut.'],
    ['Pieczemy 25 minut do zarumienienia.'],
    ['Ciasto upiec w 180 stopniach.'],
    ['Zapiekać pod przykryciem 30 minut.'],
  ])('names oven time "Pieczenie": %s', (step) => {
    expect(cookTimeLabel([step])).toBe('Pieczenie')
  })

  it.each([
    ['Gotować na małym ogniu 30 minut.'],
    ['Smażyć placki z obu stron. Do ciasta dodać proszek do pieczenia.'],
    ['Masę wyłożyć na papier do pieczenia i schłodzić.'],
    ['Podsmażyć pieczarki z cebulą.'],
    ['Podawać z pieczywem.'],
  ])('keeps "Gotowanie" otherwise: %s', (step) => {
    expect(cookTimeLabel([step])).toBe('Gotowanie')
  })

  it('reads every step, not only the first', () => {
    expect(cookTimeLabel(['Wymieszać mąkę z cukrem.', 'Piec 20 minut.'])).toBe('Pieczenie')
  })
})
