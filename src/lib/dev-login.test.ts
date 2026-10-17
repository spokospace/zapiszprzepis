import { describe, it, expect } from 'vitest'
import { devLoginEmail } from './dev-login'

const ENABLED = {
  NODE_ENV: 'development',
  DEV_LOGIN_ENABLED: '1',
  DEV_LOGIN_EMAIL_FULL: 'qa-full@example.com',
  DEV_LOGIN_EMAIL_FREE: 'qa-free@example.com',
}

describe('devLoginEmail', () => {
  it('returns the full-access account by default and for as=full', () => {
    expect(devLoginEmail(null, ENABLED)).toBe('qa-full@example.com')
    expect(devLoginEmail('full', ENABLED)).toBe('qa-full@example.com')
  })

  it('returns the free account for as=free', () => {
    expect(devLoginEmail('free', ENABLED)).toBe('qa-free@example.com')
  })

  it('is off in a production build even with every flag set', () => {
    expect(devLoginEmail('full', { ...ENABLED, NODE_ENV: 'production' })).toBeNull()
  })

  it('is off under test and when NODE_ENV is missing', () => {
    expect(devLoginEmail('full', { ...ENABLED, NODE_ENV: 'test' })).toBeNull()
    expect(devLoginEmail('full', { ...ENABLED, NODE_ENV: undefined })).toBeNull()
  })

  it('is off unless DEV_LOGIN_ENABLED is exactly 1', () => {
    expect(devLoginEmail('full', { ...ENABLED, DEV_LOGIN_ENABLED: undefined })).toBeNull()
    expect(devLoginEmail('full', { ...ENABLED, DEV_LOGIN_ENABLED: 'true' })).toBeNull()
    expect(devLoginEmail('full', { ...ENABLED, DEV_LOGIN_ENABLED: '0' })).toBeNull()
  })

  it('is off when the matching email is unset or blank', () => {
    expect(devLoginEmail('full', { ...ENABLED, DEV_LOGIN_EMAIL_FULL: undefined })).toBeNull()
    expect(devLoginEmail('free', { ...ENABLED, DEV_LOGIN_EMAIL_FREE: '  ' })).toBeNull()
  })

  it('rejects an unknown role instead of falling back to an account', () => {
    expect(devLoginEmail('admin', ENABLED)).toBeNull()
    expect(devLoginEmail('', ENABLED)).toBeNull()
  })
})
