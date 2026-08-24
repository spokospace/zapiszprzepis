import { describe, it, expect } from 'vitest'
import { safeNext, mapAuthError } from '@/lib/safe-redirect'

const ORIGIN = 'https://zapiszprzepis.pl'

// Regression lock for the open redirect on the auth callback. The previous
// guard was the path regex /^\/(?!\/)/ , which blocked `//evil.com` but let
// `/\evil.com` through — `new URL()` treats a backslash as a slash for special
// schemes, so it resolved to https://evil.com/ from a link that looked like ours.
describe('safeNext — redirect guard', () => {
  it('keeps ordinary in-app paths', () => {
    expect(safeNext('/recipes', ORIGIN)).toBe('/recipes')
    expect(safeNext('/recipes?category=zupy', ORIGIN)).toBe('/recipes?category=zupy')
  })

  it('rejects the backslash bypass that used to escape the origin', () => {
    const backslash = String.fromCharCode(47, 92) + 'evil.com'
    // The bug, demonstrated: URL parsing alone resolves this off-site.
    expect(new URL(backslash, ORIGIN).origin).toBe('https://evil.com')
    // …and closed.
    expect(safeNext(backslash, ORIGIN)).toBe('/')
  })

  it('rejects protocol-relative and absolute off-site targets', () => {
    expect(safeNext('//evil.com', ORIGIN)).toBe('/')
    expect(safeNext('https://evil.com/x', ORIGIN)).toBe('/')
  })

  it('rejects encoded separator tricks', () => {
    expect(safeNext('/%2fevil.com', ORIGIN)).toBe('/')
    expect(safeNext('/%5cevil.com', ORIGIN)).toBe('/')
  })

  it('falls back to the home page for missing or empty input', () => {
    expect(safeNext(null, ORIGIN)).toBe('/')
    expect(safeNext('', ORIGIN)).toBe('/')
  })

  it('never returns an absolute URL', () => {
    for (const raw of ['https://evil.com', '//evil.com', '/ok']) {
      expect(safeNext(raw, ORIGIN).startsWith('http')).toBe(false)
    }
  })
})

describe('mapAuthError — exact code matching', () => {
  it('maps the known codes', () => {
    expect(mapAuthError('otp_expired')).toBe('expired')
    expect(mapAuthError('flow_state_not_found')).toBe('expired')
    expect(mapAuthError('flow_state_used')).toBe('used')
  })

  it('sends unknown codes to the default branch instead of guessing', () => {
    // Substring matching would have bucketed these as expired/used.
    expect(mapAuthError('validation_paused')).toBe('unknown')
    expect(mapAuthError('unused_factor')).toBe('unknown')
    expect(mapAuthError(undefined)).toBe('unknown')
  })
})
