import { describe, it, expect } from 'vitest'
import { addedVerbYou, genderFormOf, youAddedLine } from './gender-form'

describe('genderFormOf', () => {
  it('maps the stored gender to a form', () => {
    expect(genderFormOf('female')).toBe('f')
    expect(genderFormOf('male')).toBe('m')
  })

  it.each([undefined, null, '', 'f', 'other'])('maps %p to null', (raw) => {
    expect(genderFormOf(raw)).toBeNull()
  })
})

describe('verb forms', () => {
  it('second person', () => {
    expect(addedVerbYou('f')).toBe('Dodałaś')
    expect(addedVerbYou('m')).toBe('Dodałeś')
    expect(addedVerbYou(null)).toBeNull()
  })
})

describe('youAddedLine', () => {
  it('second person with the plural', () => {
    expect(youAddedLine('f', 3)).toBe('Dodałaś 3 przepisy.')
    expect(youAddedLine('m', 1)).toBe('Dodałeś 1 przepis.')
    expect(youAddedLine('m', 25)).toBe('Dodałeś 25 przepisów.')
  })

  it('null when unknown or nothing added', () => {
    expect(youAddedLine(null, 3)).toBeNull()
    expect(youAddedLine('f', 0)).toBeNull()
  })
})
