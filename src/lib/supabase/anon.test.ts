import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'anon-key' }))

const createClient = vi.fn(() => ({ __anonClient: true }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const { createSupabaseAnonClient } = await import('./anon')

describe('createSupabaseAnonClient', () => {
  it('builds a cookie-free anon client with no session (persist/refresh off)', () => {
    const client = createSupabaseAnonClient()
    expect(createClient).toHaveBeenCalledWith('https://db.example', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    expect(client).toEqual({ __anonClient: true })
  })

  it('reuses one client across calls (singleton per isolate)', () => {
    createSupabaseAnonClient()
    createSupabaseAnonClient()
    // Still one construction despite three total calls across both tests.
    expect(createClient).toHaveBeenCalledTimes(1)
  })
})
