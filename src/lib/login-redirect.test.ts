import { describe, it, expect } from 'vitest'
import { loginPath, loginErrorPath, resolveLoginNext } from './login-redirect'

describe('loginErrorPath', () => {
  it('carries the error and a non-root next', () => {
    expect(loginErrorPath('oauth_cancelled', '/przepis/sernik?fav=1')).toBe(
      '/login?error=oauth_cancelled&next=%2Fprzepis%2Fsernik%3Ffav%3D1',
    )
  })

  it('drops a root or missing next', () => {
    expect(loginErrorPath('oauth_no_email', '/')).toBe('/login?error=oauth_no_email')
    expect(loginErrorPath('oauth_no_email')).toBe('/login?error=oauth_no_email')
  })
})

const ORIGIN = 'https://zapiszprzepis.pl'

describe('loginPath', () => {
  it('is plain /login without a destination', () => {
    expect(loginPath()).toBe('/login')
    expect(loginPath(null)).toBe('/login')
    expect(loginPath('')).toBe('/login')
  })

  it('encodes the destination, including its own query', () => {
    expect(loginPath('/przepisy/ciasta?tag=x')).toBe('/login?next=%2Fprzepisy%2Fciasta%3Ftag%3Dx')
  })

  it('carries the recipe a guest asked to favorite (E01-S06)', () => {
    expect(loginPath('/przepis/tiramisu', 12)).toBe('/login?next=%2Fprzepis%2Ftiramisu&fav=12')
    expect(loginPath(null, 12)).toBe('/login?fav=12')
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
