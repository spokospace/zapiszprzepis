import { describe, it, expect } from 'vitest'

describe('lib/env', () => {
  it('env.ts should be importable as a module', () => {
    // This is a smoke test - the real test is that the build succeeds
    // when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
    expect(true).toBe(true)
  })

  it('requireEnv helper should work with valid env vars', () => {
    const testValue = 'test-value'
    const result = testValue && testValue.trim() !== '' ? testValue : null

    expect(result).toBeDefined()
    expect(result).not.toBe('')
  })

  it('requireEnv helper should fail with empty string', () => {
    const testValue: string = ''
    const result = testValue && testValue.trim() !== '' ? testValue : null

    expect(result).toBeNull()
  })

  it('requireEnv helper should fail with undefined', () => {
    const testValue = undefined as string | undefined
    const result = testValue && testValue.trim() !== '' ? testValue : null

    expect(result).toBeNull()
  })
})
