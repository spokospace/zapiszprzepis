import { describe, expect, it } from 'vitest'
import { enabledProvider, parseOAuthProviders } from './oauth-providers'

describe('parseOAuthProviders', () => {
  it('is empty when unset (OAuth off by default)', () => {
    expect(parseOAuthProviders(undefined)).toEqual([])
    expect(parseOAuthProviders(null)).toEqual([])
    expect(parseOAuthProviders('')).toEqual([])
  })

  it('trims, lower-cases, dedupes and keeps canonical order (Facebook first, as on 3a)', () => {
    expect(parseOAuthProviders(' google , Facebook,GOOGLE ')).toEqual(['facebook', 'google'])
  })

  it('drops unknown providers', () => {
    expect(parseOAuthProviders('github,google,twitter')).toEqual(['google'])
  })
})

describe('enabledProvider', () => {
  it('accepts only an enabled provider', () => {
    expect(enabledProvider('google', ['google'])).toBe('google')
    expect(enabledProvider('facebook', ['google'])).toBeNull()
    expect(enabledProvider('github', ['google', 'facebook'])).toBeNull()
    expect(enabledProvider(null, ['google'])).toBeNull()
  })
})
