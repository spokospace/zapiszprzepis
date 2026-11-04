import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { getCachedJwks, resetJwksCache } from '@/lib/supabase/jwks-cache'

const URL_A = 'https://a.supabase.co'
const KEY = { kid: 'k1', kty: 'EC', alg: 'ES256' }

function answer(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

describe('getCachedJwks', () => {
  beforeEach(() => resetJwksCache())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fetches the keys once and serves the next calls from memory', async () => {
    const fetchMock = vi.fn(async () => answer({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [KEY] })
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [KEY] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls as unknown[][])[0][0]).toBe(`${URL_A}/auth/v1/.well-known/jwks.json`)
  })

  it('fetches again once the kept keys are ten minutes old', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => answer({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    await getCachedJwks(URL_A)
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    await getCachedJwks(URL_A)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not serve one project\'s keys for another', async () => {
    const fetchMock = vi.fn(async () => answer({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    await getCachedJwks(URL_A)
    await getCachedJwks('https://b.supabase.co')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one fetch between concurrent callers', async () => {
    const fetchMock = vi.fn(async () => answer({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    const results = await Promise.all([getCachedJwks(URL_A), getCachedJwks(URL_A), getCachedJwks(URL_A)])
    expect(results).toEqual([{ keys: [KEY] }, { keys: [KEY] }, { keys: [KEY] }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns no keys when the fetch fails or answers badly, and tries again after half a minute', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Network connection lost'))
      .mockResolvedValueOnce(answer({}, { status: 503 }))
      .mockResolvedValueOnce(answer({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [] })
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30 * 1000 + 1)
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [] })
    vi.advanceTimersByTime(30 * 1000 + 1)
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [KEY] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('remembers briefly that the project publishes no keys (shared-secret signing)', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => answer({ keys: [] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [] })
    expect(await getCachedJwks(URL_A)).toEqual({ keys: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30 * 1000 + 1)
    await getCachedJwks(URL_A)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
