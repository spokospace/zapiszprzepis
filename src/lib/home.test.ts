import { describe, it, expect } from 'vitest'
import { homeGreeting, POPULAR_SEARCHES } from './home'

describe('homeGreeting', () => {
  it('greets by the vocative', () => {
    expect(homeGreeting('Aniu')).toBe('Dzień dobry, Aniu!')
    expect(homeGreeting('  Marku ')).toBe('Dzień dobry, Marku!')
  })

  it('falls back to a plain greeting when the vocative is unknown', () => {
    expect(homeGreeting(null)).toBe('Dzień dobry!')
    expect(homeGreeting(undefined)).toBe('Dzień dobry!')
    expect(homeGreeting('   ')).toBe('Dzień dobry!')
  })
})

describe('POPULAR_SEARCHES', () => {
  it('has distinct, non-blank terms', () => {
    expect(POPULAR_SEARCHES.length).toBeGreaterThan(0)
    expect(new Set(POPULAR_SEARCHES).size).toBe(POPULAR_SEARCHES.length)
    for (const term of POPULAR_SEARCHES) expect(term.trim()).toBe(term)
  })
})
