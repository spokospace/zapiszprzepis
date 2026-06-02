import { describe, it, expect } from 'vitest'
import { mapAuthError } from './auth-errors'

// Tests lock the current `.includes()`-based behavior.
// F2 lesson (context/foundation/lessons.md rule #2) recommends a refactor to
// `Set` exact-equality matching — that change is out-of-scope here and will
// touch this test file when it lands.

describe('mapAuthError', () => {
  it('returns "unknown" for undefined code', () => {
    expect(mapAuthError(undefined)).toBe('unknown')
  })

  it('returns "unknown" for empty string', () => {
    expect(mapAuthError('')).toBe('unknown')
  })

  it('returns "expired" for any code containing "expired"', () => {
    expect(mapAuthError('otp_expired')).toBe('expired')
    expect(mapAuthError('flow_state_expired')).toBe('expired')
    expect(mapAuthError('token_expired')).toBe('expired')
  })

  it('returns "used" for any code containing "used"', () => {
    expect(mapAuthError('otp_used')).toBe('used')
    expect(mapAuthError('already_used')).toBe('used')
  })

  it('returns "expired" for the special-case flow_state_not_found', () => {
    expect(mapAuthError('flow_state_not_found')).toBe('expired')
  })

  it('returns "unknown" for unrecognized codes', () => {
    expect(mapAuthError('invalid_grant')).toBe('unknown')
    expect(mapAuthError('rate_limited')).toBe('unknown')
    expect(mapAuthError('something_else')).toBe('unknown')
  })
})
