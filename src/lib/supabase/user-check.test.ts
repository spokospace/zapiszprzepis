import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
  type User,
} from '@supabase/supabase-js'
import { checkClaims, checkUser, isTransientAuthError } from '@/lib/supabase/user-check'

const USER = { id: 'u1' } as User

function claimsClient(...answers: Array<{ sub?: string; error?: unknown } | Error>) {
  const getClaims = vi.fn()
  for (const a of answers) {
    if (a instanceof Error) getClaims.mockRejectedValueOnce(a)
    else if (a.sub) getClaims.mockResolvedValueOnce({ data: { claims: { sub: a.sub } }, error: null })
    else getClaims.mockResolvedValueOnce({ data: null, error: a.error ?? null })
  }
  return { auth: { getClaims } }
}

function client(...answers: Array<{ user?: User; error?: unknown } | Error>) {
  const getUser = vi.fn()
  for (const a of answers) {
    if (a instanceof Error) getUser.mockRejectedValueOnce(a)
    else getUser.mockResolvedValueOnce({ data: { user: a.user ?? null }, error: a.error ?? null })
  }
  return { auth: { getUser } }
}

describe('isTransientAuthError', () => {
  it('reads a missing session or a malformed token as a real guest', () => {
    expect(isTransientAuthError(new AuthSessionMissingError())).toBe(false)
    expect(isTransientAuthError(new AuthInvalidJwtError('Invalid JWT'))).toBe(false)
  })

  it('reads a token Supabase rejected as logged out', () => {
    expect(isTransientAuthError(new AuthApiError('Session not found', 403, 'session_not_found'))).toBe(false)
    expect(isTransientAuthError(new AuthApiError('invalid JWT', 401, 'bad_jwt'))).toBe(false)
  })

  it('reads network failures, 5xx, 429 and non-JSON answers as undecided', () => {
    expect(isTransientAuthError(new AuthRetryableFetchError('fetch failed', 0))).toBe(true)
    expect(isTransientAuthError(new AuthApiError('upstream', 502, undefined))).toBe(true)
    expect(isTransientAuthError(new AuthApiError('Too many requests', 429, 'over_request_rate_limit'))).toBe(true)
    expect(isTransientAuthError(new AuthUnknownError('Unexpected token <', null))).toBe(true)
    expect(isTransientAuthError(new TypeError('Network connection lost'))).toBe(true)
  })

  it('has nothing to say about a success', () => {
    expect(isTransientAuthError(null)).toBe(false)
  })
})

describe('checkUser', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the user on the first success, without a retry or a log line', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = client({ user: USER })
    expect(await checkUser(supabase, 'test')).toEqual({ user: USER, transient: false })
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalled()
  })

  it('returns a real guest at once, without a retry', async () => {
    const supabase = client({ error: new AuthSessionMissingError() })
    expect(await checkUser(supabase, 'test')).toEqual({ user: null, transient: false })
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('recovers when the retry succeeds, and logs the first failure', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = client({ error: new AuthRetryableFetchError('fetch failed', 0) }, { user: USER })
    expect(await checkUser(supabase, 'middleware /dodaj')).toEqual({ user: USER, transient: false })
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledTimes(1)
    expect(String(log.mock.calls[0][1])).toContain('"where":"middleware /dodaj"')
    expect(String(log.mock.calls[0][1])).toContain('"name":"AuthRetryableFetchError"')
  })

  it('does not retry a rate limit: it is still in force a moment later', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = client({ error: new AuthApiError('Too many requests', 429, 'over_request_rate_limit') })
    expect(await checkUser(supabase, 'test')).toEqual({ user: null, transient: true })
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('gives up as undecided after two transient failures, a thrown one included', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = client(new TypeError('Network connection lost'), { error: new AuthApiError('x', 503, undefined) })
    expect(await checkUser(supabase, 'test')).toEqual({ user: null, transient: true })
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(2)
  })
})

describe('checkClaims', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the id from the verified claims, without a retry or a log line', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = claimsClient({ sub: 'u1' })
    expect(await checkClaims(supabase, 'test')).toEqual({ user: { id: 'u1' }, transient: false })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalled()
  })

  it('hands the supplied signing keys to getClaims', async () => {
    const supabase = claimsClient({ sub: 'u1' })
    const jwks = { keys: [{ kid: 'k1', kty: 'EC' }] } as never
    await checkClaims(supabase, 'test', jwks)
    expect(supabase.auth.getClaims).toHaveBeenCalledWith(undefined, { jwks })
  })

  it('reads no session (no data, no error) as a guest, without a retry', async () => {
    const supabase = claimsClient({})
    expect(await checkClaims(supabase, 'test')).toEqual({ user: null, transient: false })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1)
  })

  it('reads claims without a subject as a guest', async () => {
    const supabase = { auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: {} }, error: null }) } }
    expect(await checkClaims(supabase, 'test')).toEqual({ user: null, transient: false })
  })

  it('reads a bad signature or an expired token as a guest at once', async () => {
    const supabase = claimsClient({ error: new AuthInvalidJwtError('Invalid JWT signature') })
    expect(await checkClaims(supabase, 'test')).toEqual({ user: null, transient: false })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1)
  })

  it('reads a refresh token Supabase rejected as a guest', async () => {
    const supabase = claimsClient({ error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') })
    expect(await checkClaims(supabase, 'test')).toEqual({ user: null, transient: false })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1)
  })

  it('recovers when the retry succeeds, and logs the first failure under getClaims', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = claimsClient({ error: new AuthRetryableFetchError('fetch failed', 0) }, { sub: 'u1' })
    expect(await checkClaims(supabase, 'middleware /dodaj')).toEqual({ user: { id: 'u1' }, transient: false })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledTimes(1)
    expect(String(log.mock.calls[0][0])).toContain('getClaims')
    expect(String(log.mock.calls[0][1])).toContain('"where":"middleware /dodaj"')
  })

  it('does not retry a rate limit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = claimsClient({ error: new AuthApiError('Too many requests', 429, 'over_request_rate_limit') })
    expect(await checkClaims(supabase, 'test')).toEqual({ user: null, transient: true })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1)
  })

  it('gives up as undecided after two transient failures, a thrown one included', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = claimsClient(new TypeError('Network connection lost'), { error: new AuthApiError('x', 503, undefined) })
    expect(await checkClaims(supabase, 'test')).toEqual({ user: null, transient: true })
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(2)
  })
})
