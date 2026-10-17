import { describe, it, expect } from 'vitest'
import { FIRST_NAME_MAX, greetingName, validateFirstName } from './first-name'
import { greeting } from './vocative'

describe('validateFirstName', () => {
  it('trims and collapses whitespace', () => {
    expect(validateFirstName('  Ania  ')).toEqual({ ok: true, value: 'Ania' })
    expect(validateFirstName('Anna   Maria')).toEqual({ ok: true, value: 'Anna Maria' })
  })

  it('accepts Polish letters, hyphens and apostrophes', () => {
    expect(validateFirstName('Łucja')).toEqual({ ok: true, value: 'Łucja' })
    expect(validateFirstName('Anna-Maria')).toEqual({ ok: true, value: 'Anna-Maria' })
    expect(validateFirstName("O'Neil")).toEqual({ ok: true, value: "O'Neil" })
  })

  it('treats blank or missing as "clear"', () => {
    expect(validateFirstName('   ')).toEqual({ ok: true, value: null })
    expect(validateFirstName(null)).toEqual({ ok: true, value: null })
  })

  it('rejects digits, symbols, dangling punctuation and overlong names', () => {
    for (const bad of ['Ania2', 'Ania!', '-Ania', 'Ania-', "Ania''", 'a'.repeat(FIRST_NAME_MAX + 1)]) {
      expect(validateFirstName(bad).ok).toBe(false)
    }
    expect(validateFirstName(42).ok).toBe(false)
  })
})

describe('greetingName', () => {
  it('prefers the private first name', () => {
    expect(greetingName('Ania', 'Kuchnia Marka')).toBe('Ania')
  })

  it('falls back to the first word of the display name (S12 behavior)', () => {
    expect(greetingName(null, 'Marek Nowak')).toBe('Marek')
    expect(greetingName('  ', 'Marek Nowak')).toBe('Marek')
  })

  it('feeds the S12 vocative greeting', () => {
    expect(greeting(greetingName('Ania', 'Kuchnia Marka'))).toBe('Dzień dobry, Aniu!')
    // Without a first name the display name's first word is inflected — the
    // reason "Imię" exists ("Kuchnia Marka" → "Kuchnio").
    expect(greeting(greetingName(null, 'Marek Nowak'))).toBe('Dzień dobry, Marku!')
    expect(greeting(greetingName(null, null))).toBe('Dzień dobry!')
  })
})
