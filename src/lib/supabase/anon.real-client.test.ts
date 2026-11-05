import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'anon-key' }))

const { createSupabaseAnonClient } = await import('./anon')

afterEach(() => vi.unstubAllGlobals())

// The real SDK, unlike anon.test.ts: a read must carry the anon key and never touch auth.
describe('createSupabaseAnonClient with the real SDK', () => {
  it('reads with the anon key as bearer and sends nothing to the auth server', async () => {
    const calls: { url: string; authorization: string | null }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') })
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
      }),
    )

    const { data, error } = await createSupabaseAnonClient().from('public_recipes').select('slug')

    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(calls.some((c) => c.url.includes('/rest/v1/public_recipes'))).toBe(true)
    expect(calls.find((c) => c.url.includes('/rest/v1/'))?.authorization).toBe('Bearer anon-key')
    expect(calls.some((c) => c.url.includes('/auth/v1/'))).toBe(false)
  })
})
