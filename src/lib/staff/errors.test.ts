import { describe, it, expect } from 'vitest'
import { staffErrorCode, staffErrorMessage } from './errors'

describe('staffErrorCode', () => {
  it('passes a code the SQL functions raise', () => {
    expect(staffErrorCode({ message: 'cannot_target_staff' })).toBe('cannot_target_staff')
    expect(staffErrorCode({ message: 'last_admin' })).toBe('last_admin')
  })

  it('maps any other database text to unknown, so it is never shown to staff', () => {
    expect(staffErrorCode({ message: 'duplicate key value violates unique constraint "x"' })).toBe('unknown')
    expect(staffErrorCode({})).toBe('unknown')
    expect(staffErrorCode(null)).toBe('unknown')
  })
})

describe('staffErrorMessage', () => {
  it('returns Polish text for a known code', () => {
    expect(staffErrorMessage('forbidden')).toMatch(/uprawnie/)
  })

  it('returns null for a code from a URL that is not ours, so it is not reflected', () => {
    expect(staffErrorMessage('<script>alert(1)</script>')).toBeNull()
    expect(staffErrorMessage('toString')).toBeNull()
    expect(staffErrorMessage(null)).toBeNull()
  })
})
