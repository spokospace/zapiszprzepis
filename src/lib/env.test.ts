import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('lib/env', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('exports SUPABASE_URL and SUPABASE_ANON_KEY when env vars are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'

    const env = await import('./env')

    expect(env.SUPABASE_URL).toBe('https://example.supabase.co')
    expect(env.SUPABASE_ANON_KEY).toBe('test_anon_key')
  })

  it('throws with a clear name when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'

    await expect(import('./env')).rejects.toThrow(
      'Missing required env: NEXT_PUBLIC_SUPABASE_URL',
    )
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is an empty string', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'

    await expect(import('./env')).rejects.toThrow(
      'Missing required env: NEXT_PUBLIC_SUPABASE_URL',
    )
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL contains only whitespace', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '   '
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'

    await expect(import('./env')).rejects.toThrow(
      'Missing required env: NEXT_PUBLIC_SUPABASE_URL',
    )
  })

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    await expect(import('./env')).rejects.toThrow(
      'Missing required env: NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  })
})
