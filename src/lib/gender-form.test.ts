import { describe, it, expect } from 'vitest'
import {
  addedVerb,
  addedVerbYou,
  authorLinePrefix,
  genderFormOf,
  parseGenderForm,
  profileCountLine,
  profileEmptyText,
  youAddedLine,
} from './gender-form'

describe('parseGenderForm', () => {
  it('keeps only the two forms', () => {
    expect(parseGenderForm('f')).toBe('f')
    expect(parseGenderForm('m')).toBe('m')
  })

  it.each([undefined, null, '', 'female', 'male', 'F', 1, {}])('maps %p to null (neutral)', (raw) => {
    expect(parseGenderForm(raw)).toBeNull()
  })
})

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
  it('third person', () => {
    expect(addedVerb('f')).toBe('Dodała')
    expect(addedVerb('m')).toBe('Dodał')
    expect(addedVerb(null)).toBeNull()
  })

  it('second person', () => {
    expect(addedVerbYou('f')).toBe('Dodałaś')
    expect(addedVerbYou('m')).toBe('Dodałeś')
    expect(addedVerbYou(null)).toBeNull()
  })
})

describe('authorLinePrefix', () => {
  it('gendered when known, neutral otherwise', () => {
    expect(authorLinePrefix('f')).toBe('Dodała')
    expect(authorLinePrefix('m')).toBe('Dodał')
    expect(authorLinePrefix(null)).toBe('Dodane przez')
  })
})

describe('profileCountLine', () => {
  it.each([
    ['f', 1, 'Dodała 1 przepis'],
    ['f', 3, 'Dodała 3 przepisy'],
    ['m', 5, 'Dodał 5 przepisów'],
    ['m', 12, 'Dodał 12 przepisów'],
    ['f', 22, 'Dodała 22 przepisy'],
  ] as const)('%s, %d → %s', (form, count, text) => {
    expect(profileCountLine(form, count)).toBe(text)
  })

  it('neutral when the form is unknown', () => {
    expect(profileCountLine(null, 5)).toBe('Dodane przepisy: 5')
  })
})

describe('profileEmptyText', () => {
  it('gendered when known', () => {
    expect(profileEmptyText('f', 'Ania K.')).toBe('Ania K. nie dodała jeszcze przepisów.')
    expect(profileEmptyText('m', 'Jan')).toBe('Jan nie dodał jeszcze przepisów.')
  })

  it('neutral when unknown', () => {
    expect(profileEmptyText(null, 'Ania')).toBe('Na tym profilu nie ma jeszcze przepisów.')
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
