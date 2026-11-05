import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'anon-key' }))

const createClient = vi.fn(() => ({ __anonClient: true }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const { createSupabaseAnonClient } = await import('./anon')

describe('createSupabaseAnonClient', () => {
  it('builds a cookie-free client without the auth client, whose init promise could hang reads', async () => {
    const client = createSupabaseAnonClient()
    expect(createClient).toHaveBeenCalledWith('https://db.example', 'anon-key', { accessToken: expect.any(Function) })
    const options = (createClient.mock.calls[0] as unknown[])[2] as { accessToken: () => Promise<string | null> }
    await expect(options.accessToken()).resolves.toBeNull()
    expect(client).toEqual({ __anonClient: true })
  })

  it('reuses one client across calls (singleton per isolate)', () => {
    const first = createSupabaseAnonClient()
    const second = createSupabaseAnonClient()
    // Same instance on every call; checked by identity, not by mock call count,
    // because vitest clears mock history between tests.
    expect(second).toBe(first)
  })
})
