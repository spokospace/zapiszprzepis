import { describe, it, expect } from 'vitest'
import { EMAIL_REGEX, SAFE_NEXT_REGEX, isValidEmail, isSafeNext } from './auth-validation'

describe('EMAIL_REGEX / isValidEmail', () => {
  it('accepts standard email forms', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('user@domain.com')).toBe(true)
    expect(isValidEmail('user.name@example.com.pl')).toBe(true)
    expect(isValidEmail('user+tag@gmail.com')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('plain')).toBe(false)
    expect(isValidEmail('@nodomain.co')).toBe(false)
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('a@')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })

  it('rejects whitespace-containing addresses', () => {
    expect(isValidEmail('a @b.co')).toBe(false)
    expect(isValidEmail('a@ b.co')).toBe(false)
    expect(isValidEmail(' a@b.co')).toBe(false)
  })

  it('regex and helper agree', () => {
    expect(EMAIL_REGEX.test('a@b.co')).toBe(isValidEmail('a@b.co'))
    expect(EMAIL_REGEX.test('invalid')).toBe(isValidEmail('invalid'))
  })
})

describe('SAFE_NEXT_REGEX / isSafeNext', () => {
  it('accepts root-relative paths', () => {
    expect(isSafeNext('/')).toBe(true)
    expect(isSafeNext('/home')).toBe(true)
    expect(isSafeNext('/login/sub')).toBe(true)
    expect(isSafeNext('/path?q=1')).toBe(true)
  })

  it('rejects protocol-relative URLs (//evil)', () => {
    expect(isSafeNext('//evil.com')).toBe(false)
    expect(isSafeNext('//evil.com/path')).toBe(false)
  })

  it('rejects absolute external URLs', () => {
    expect(isSafeNext('https://evil.com')).toBe(false)
    expect(isSafeNext('http://evil.com')).toBe(false)
  })

  it('rejects strings without leading slash', () => {
    expect(isSafeNext('relative')).toBe(false)
    expect(isSafeNext('home')).toBe(false)
    expect(isSafeNext('')).toBe(false)
  })

  // F2 lesson (lessons.md rule #1) flags that this regex does NOT block all
  // open-redirect vectors. Tests below document known bypass classes — when
  // the regex is refactored to `new URL(next, origin); url.origin === origin`,
  // these expectations will need to flip and the tests become regression
  // safeguards for the new behavior.
  it('does NOT block known regex bypass vectors (documented limitation)', () => {
    expect(isSafeNext('/\\evil.com')).toBe(true)
    expect(isSafeNext('/%2fevil.com')).toBe(true)
  })

  it('regex and helper agree', () => {
    expect(SAFE_NEXT_REGEX.test('/home')).toBe(isSafeNext('/home'))
    expect(SAFE_NEXT_REGEX.test('//evil')).toBe(isSafeNext('//evil'))
  })
})
