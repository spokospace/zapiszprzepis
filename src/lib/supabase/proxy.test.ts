import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'anon-key' }))
const createServerClient = vi.fn(() => ({}))
vi.mock('@supabase/ssr', () => ({ createServerClient }))
const getCachedJwks = vi.fn(async () => ({ keys: [] }))
vi.mock('./jwks-cache', () => ({ getCachedJwks }))
const checkClaims = vi.fn(async () => ({ user: { id: 'u1' }, transient: false }))
vi.mock('./user-check', () => ({ checkClaims }))

const { updateSession } = await import('./proxy')

const request = (headers: Record<string, string> = {}) => new NextRequest('http://localhost/przepis/zupa', { headers })

describe('updateSession (#710)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does no session work for a request with no auth cookie, as for a guest', async () => {
    const result = await updateSession(request({ cookie: 'zp-text-scale=2' }))
    expect(result.user).toBeNull()
    expect(result.authTransient).toBe(false)
    expect(createServerClient).not.toHaveBeenCalled()
    expect(getCachedJwks).not.toHaveBeenCalled()
    expect(checkClaims).not.toHaveBeenCalled()
  })

  it('checks the session when the auth cookie is there, also chunked', async () => {
    for (const cookie of ['sb-abc-auth-token=x', 'sb-abc-auth-token.0=x; sb-abc-auth-token.1=y']) {
      vi.clearAllMocks()
      const result = await updateSession(request({ cookie }))
      expect(checkClaims).toHaveBeenCalledTimes(1)
      expect(result.user).toEqual({ id: 'u1' })
    }
  })

  it('checks the session during an OAuth sign-in, while only the code verifier cookie exists', async () => {
    await updateSession(request({ cookie: 'sb-abc-auth-token-code-verifier=v' }))
    expect(checkClaims).toHaveBeenCalledTimes(1)
  })
})
