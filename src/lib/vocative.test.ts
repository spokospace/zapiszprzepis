import { describe, expect, it } from 'vitest'
import { firstNameOf, greeting, vocative } from './vocative'

describe('vocative', () => {
  it.each([
    ['Piotr', 'Piotrze'],
    ['Paweł', 'Pawle'],
    ['Marek', 'Marku'],
    ['Szymon', 'Szymonie'],
    ['Jerzy', 'Jerzy'],
    ['Ola', 'Olu'],
    ['Ela', 'Elu'],
  ])('uses the dictionary for %s', (name, expected) => {
    expect(vocative(name)).toBe(expected)
  })

  it.each([
    ['Basia', 'Basiu'],
    ['Ania', 'Aniu'],
    ['Kasia', 'Kasiu'],
    ['Zuzia', 'Zuziu'],
    ['Lucia', 'Luciu'],
  ])('applies -sia/-nia/-cia/-zia → -iu to %s', (name, expected) => {
    expect(vocative(name)).toBe(expected)
  })

  it.each([
    ['Magda', 'Magdo'],
    ['Agnieszka', 'Agnieszko'],
    ['Ewa', 'Ewo'],
    ['Julia', 'Julio'],
    ['Kuba', 'Kubo'],
  ])('applies -a → -o to %s', (name, expected) => {
    expect(vocative(name)).toBe(expected)
  })

  it('is case-insensitive and capitalises the result', () => {
    expect(vocative('ANIA')).toBe('Aniu')
    expect(vocative('  łukasz ')).toBe('Łukaszu')
  })

  it('returns null when unsure', () => {
    expect(vocative('Xawery')).toBeNull()
    expect(vocative('John')).toBeNull()
  })

  it('returns null for placeholders and non-names', () => {
    expect(vocative('Użytkownik')).toBeNull()
    expect(vocative('uzytkownik')).toBeNull()
    expect(vocative('')).toBeNull()
    expect(vocative('A')).toBeNull()
    expect(vocative('Ania2')).toBeNull()
    expect(vocative('Anna-Maria')).toBeNull()
    expect(vocative(null)).toBeNull()
    expect(vocative(undefined)).toBeNull()
  })
})

describe('firstNameOf', () => {
  it('takes the first word of a display name', () => {
    expect(firstNameOf('Ania K.')).toBe('Ania')
    expect(firstNameOf('  Piotr   Nowak ')).toBe('Piotr')
  })

  it('returns null for empty input', () => {
    expect(firstNameOf('   ')).toBeNull()
    expect(firstNameOf(null)).toBeNull()
  })
})

describe('greeting', () => {
  it('greets with the vocative when known', () => {
    expect(greeting('Ania K.')).toBe('Dzień dobry, Aniu!')
    expect(greeting('Piotr N.')).toBe('Dzień dobry, Piotrze!')
  })

  it('falls back to a plain greeting', () => {
    expect(greeting('Użytkownik')).toBe('Dzień dobry!')
    expect(greeting('Xawery Z.')).toBe('Dzień dobry!')
    expect(greeting(null)).toBe('Dzień dobry!')
  })
})
