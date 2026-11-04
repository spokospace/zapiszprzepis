import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Integration test for #232: the real Supabase client (real @supabase/ssr cookies, real
// getClaims signature check) against a fake Auth server that signs tokens with an ES256
// key, as a project on asymmetric JWT signing keys does. Only the network is faked, so
// what the test counts is what production would send to Supabase.
vi.mock('@/lib/env', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
}))

import { middleware } from '@/middleware'
import { updateSession } from '@/lib/supabase/proxy'
import { resetJwksCache } from '@/lib/supabase/jwks-cache'

const COOKIE = 'sb-test-auth-token'
const KID = 'test-key-1'

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(typeof bytes === 'string' ? bytes : bytes).toString('base64url')

let signingKey: CryptoKey
let jwks: { keys: Array<JsonWebKey & { kid: string }> }

async function signJwt(sub: string, expiresInSeconds: number, key: CryptoKey = signingKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: KID }))
  const payload = b64url(
    JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + expiresInSeconds }),
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`
}

function sessionCookie(accessToken: string, expiresAt: number): string {
  const session = {
    access_token: accessToken,
    refresh_token: 'refresh-1',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: 'ignored', aud: 'authenticated' },
  }
  return `${COOKIE}=base64-${b64url(JSON.stringify(session))}`
}

function get(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined)
}

/** What the fake Auth server was asked, in order. */
let calls: string[]
let jwksAvailable: boolean

beforeEach(async () => {
  resetJwksCache()
  calls = []
  jwksAvailable = true
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  signingKey = pair.privateKey
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  jwks = { keys: [{ ...publicJwk, kid: KID, alg: 'ES256', use: 'sig', key_ops: ['verify'] }] }

  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push(url.pathname)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/auth/v1/.well-known/jwks.json') {
      if (!jwksAvailable) throw new TypeError('Network connection lost')
      return json(jwks)
    }
    if (url.pathname === '/auth/v1/token') {
      const accessToken = await signJwt('user-refreshed', 3600)
      return json({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'refresh-2',
        user: { id: 'user-refreshed', aud: 'authenticated' },
      })
    }
    return json({ id: 'user-from-network' })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600

describe('updateSession — session verified locally', () => {
  it('recognises a signed-in user without calling the Auth server for the user', async () => {
    const token = await signJwt('user-1', 3600)
    const { user, authTransient } = await updateSession(get('/recipes', sessionCookie(token, inOneHour())))
    expect(user).toEqual({ id: 'user-1' })
    expect(authTransient).toBe(false)
    expect(calls).not.toContain('/auth/v1/user')
    expect(calls).not.toContain('/auth/v1/token')
  })

  it('fetches the signing keys once and reuses them for later requests', async () => {
    const token = await signJwt('user-1', 3600)
    const cookie = sessionCookie(token, inOneHour())
    await updateSession(get('/recipes', cookie))
    await updateSession(get('/recipes', cookie))
    await updateSession(get('/ulubione', cookie))
    expect(calls.filter((p) => p === '/auth/v1/.well-known/jwks.json')).toHaveLength(1)
    expect(calls).not.toContain('/auth/v1/user')
  })

  it('refreshes an expired access token and writes the new cookie', async () => {
    const expired = await signJwt('user-1', -60)
    const { user, response } = await updateSession(get('/recipes', sessionCookie(expired, Math.floor(Date.now() / 1000) - 60)))
    expect(calls).toContain('/auth/v1/token')
    expect(calls).not.toContain('/auth/v1/user')
    expect(user).toEqual({ id: 'user-refreshed' })
    expect(response.cookies.get(COOKIE)?.value).toBeTruthy()
  })

  it('rejects a token whose payload was swapped for another user, keeping the old signature', async () => {
    const [header, , signature] = (await signJwt('user-1', 3600)).split('.')
    const forgedPayload = b64url(
      JSON.stringify({ sub: 'victim', role: 'authenticated', aud: 'authenticated', exp: inOneHour() }),
    )
    const forged = `${header}.${forgedPayload}.${signature}`
    const { user, authTransient } = await updateSession(get('/recipes', sessionCookie(forged, inOneHour())))
    expect(user).toBeNull()
    expect(authTransient).toBe(false)
  })

  it('rejects a token signed with a key the project does not publish', async () => {
    const stranger = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const forged = await signJwt('victim', 3600, stranger.privateKey)
    const { user, authTransient } = await updateSession(get('/recipes', sessionCookie(forged, inOneHour())))
    expect(user).toBeNull()
    expect(authTransient).toBe(false)
  })

  it('treats a request with no session cookie as a guest', async () => {
    const { user, authTransient } = await updateSession(get('/recipes'))
    expect(user).toBeNull()
    expect(authTransient).toBe(false)
  })

  it('reports an undecided check, not a guest, when the signing keys cannot be fetched', async () => {
    jwksAvailable = false
    const token = await signJwt('user-1', 3600)
    const { user, authTransient } = await updateSession(get('/recipes', sessionCookie(token, inOneHour())))
    expect(user).toBeNull()
    expect(authTransient).toBe(true)
  })
})

describe('middleware — owner-only routes with the local check', () => {
  it('redirects a guest from /recipes to the login page', async () => {
    const res = await middleware(get('/recipes'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects a forged cookie like a guest', async () => {
    const [header, , signature] = (await signJwt('user-1', 3600)).split('.')
    const payload = b64url(JSON.stringify({ sub: 'victim', aud: 'authenticated', exp: inOneHour() }))
    const res = await middleware(get('/recipes', sessionCookie(`${header}.${payload}.${signature}`, inOneHour())))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('lets a valid session through, without a user lookup at Supabase', async () => {
    const token = await signJwt('user-1', 3600)
    const res = await middleware(get('/recipes', sessionCookie(token, inOneHour())))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(calls).not.toContain('/auth/v1/user')
  })

  it('does not log a signed-in visitor out when the signing keys are unreachable', async () => {
    jwksAvailable = false
    const token = await signJwt('user-1', 3600)
    const res = await middleware(get('/recipes', sessionCookie(token, inOneHour())))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('sends a signed-in visitor on the login page back to the app', async () => {
    const token = await signJwt('user-1', 3600)
    const res = await middleware(get('/login', sessionCookie(token, inOneHour())))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })
})
