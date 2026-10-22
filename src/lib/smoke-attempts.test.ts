import { describe, it, expect } from 'vitest'
import { attemptFailure } from '@/lib/smoke-attempts'

describe('attemptFailure', () => {
  it('passes a page whose every attempt was a 200', () => {
    expect(attemptFailure('/', [200, 200, 200])).toBeNull()
  })

  it('fails a page on a single intermittent error among 200s', () => {
    expect(attemptFailure('/', [200, 200, 503, 200])).toBe('page / → 1/4 attempts failed (503×1)')
  })

  it('counts each failing status, unreachable included', () => {
    expect(attemptFailure('/szukaj', [503, 200, 500, 0, 503])).toBe(
      'page /szukaj → 4/5 attempts failed (503×2, 500×1, unreachable×1)',
    )
  })

  it('treats a redirect as a failure: a public page must answer 200 to a guest', () => {
    expect(attemptFailure('/login', [307])).toBe('page /login → 1/1 attempts failed (307×1)')
  })
})
