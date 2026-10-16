import { describe, it, expect } from 'vitest'
import { validateDisplayName, DISPLAY_NAME_MAX } from './display-name'

describe('validateDisplayName', () => {
  it('accepts a normal name', () => {
    expect(validateDisplayName('Ania Kowalska')).toEqual({ ok: true, value: 'Ania Kowalska' })
  })

  it('trims surrounding whitespace and collapses internal runs', () => {
    expect(validateDisplayName('  Ania   K.  ')).toEqual({ ok: true, value: 'Ania K.' })
  })

  it('keeps Polish characters', () => {
    expect(validateDisplayName('Łukasz Żółć')).toEqual({ ok: true, value: 'Łukasz Żółć' })
  })

  it('rejects empty / whitespace-only', () => {
    expect(validateDisplayName('   ').ok).toBe(false)
    expect(validateDisplayName('').ok).toBe(false)
  })

  it('rejects too short', () => {
    expect(validateDisplayName('A').ok).toBe(false)
  })

  it('rejects too long', () => {
    expect(validateDisplayName('x'.repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false)
  })

  it('accepts exactly the max length', () => {
    const name = 'x'.repeat(DISPLAY_NAME_MAX)
    expect(validateDisplayName(name)).toEqual({ ok: true, value: name })
  })

  it('rejects non-string input', () => {
    expect(validateDisplayName(undefined).ok).toBe(false)
    expect(validateDisplayName(42).ok).toBe(false)
  })
})
