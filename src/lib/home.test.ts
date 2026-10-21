import { describe, it, expect } from 'vitest'
import { homeGreeting, POPULAR_SEARCHES } from './home'

describe('homeGreeting', () => {
  it('greets by the vocative', () => {
    expect(homeGreeting('Aniu')).toBe('Czego dziś szukasz, Aniu?')
    expect(homeGreeting('  Marku ')).toBe('Czego dziś szukasz, Marku?')
  })

  it('falls back to the guest heading when the vocative is unknown', () => {
    expect(homeGreeting(null)).toBe('Czego dziś szukasz?')
    expect(homeGreeting(undefined)).toBe('Czego dziś szukasz?')
    expect(homeGreeting('   ')).toBe('Czego dziś szukasz?')
  })
})

describe('POPULAR_SEARCHES', () => {
  it('has distinct, non-blank terms', () => {
    expect(POPULAR_SEARCHES.length).toBeGreaterThan(0)
    expect(new Set(POPULAR_SEARCHES).size).toBe(POPULAR_SEARCHES.length)
    for (const term of POPULAR_SEARCHES) expect(term.trim()).toBe(term)
  })
})
