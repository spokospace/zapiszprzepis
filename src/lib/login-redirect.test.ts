import { describe, it, expect } from 'vitest'
import { loginPath, resolveLoginNext, favoriteReturnPath } from './login-redirect'

const ORIGIN = 'https://zapiszprzepis.pl'

describe('loginPath', () => {
  it('is plain /login without a destination', () => {
    expect(loginPath()).toBe('/login')
    expect(loginPath(null)).toBe('/login')
    expect(loginPath('')).toBe('/login')
  })

  it('encodes the destination, including its own query', () => {
    expect(loginPath('/przepis/tiramisu?fav=1')).toBe('/login?next=%2Fprzepis%2Ftiramisu%3Ffav%3D1')
  })
})

describe('resolveLoginNext', () => {
  it('falls back when nothing was asked for', () => {
    expect(resolveLoginNext(undefined, ORIGIN, '/recipes')).toBe('/recipes')
    expect(resolveLoginNext(null, ORIGIN, '/recipes')).toBe('/recipes')
    expect(resolveLoginNext('   ', ORIGIN, '/recipes')).toBe('/recipes')
  })

  it('keeps a same-origin path with its query', () => {
    expect(resolveLoginNext('/przepis/tiramisu?fav=1', ORIGIN, '/recipes')).toBe('/przepis/tiramisu?fav=1')
  })

  it('refuses other origins and normalisation tricks (safeNext → /)', () => {
    expect(resolveLoginNext('https://evil.example/x', ORIGIN, '/recipes')).toBe('/')
    expect(resolveLoginNext('//evil.example', ORIGIN, '/recipes')).toBe('/')
    expect(resolveLoginNext('/\\evil.example', ORIGIN, '/recipes')).toBe('/')
  })

  it('ignores non-string input', () => {
    expect(resolveLoginNext(42, ORIGIN, '/recipes')).toBe('/recipes')
  })
})

describe('favoriteReturnPath', () => {
  it('returns to the recipe asking to add it', () => {
    expect(favoriteReturnPath('tiramisu')).toBe('/przepis/tiramisu?fav=1')
  })

  it('encodes an unexpected slug instead of breaking the path', () => {
    expect(favoriteReturnPath('a b?c')).toBe('/przepis/a%20b%3Fc?fav=1')
  })
})
