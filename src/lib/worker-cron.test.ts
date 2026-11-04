import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { backupToR2, failoverStalePendingShares, keepDatabaseAwake, type CronEnv, type R2Bucket } from '@/lib/worker-cron'

const SUPABASE_URL = 'https://project.supabase.co'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function bucketSpy(): { bucket: R2Bucket; put: ReturnType<typeof vi.fn> } {
  const put = vi.fn().mockResolvedValue(undefined)
  return { bucket: { put } as unknown as R2Bucket, put }
}

function env(overrides: Partial<CronEnv> = {}): CronEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('keepDatabaseAwake', () => {
  it('queries a table rather than the auth health endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await keepDatabaseAwake(env())

    // /auth/v1/health answers without touching Postgres, so it would not count
    // as activity and the project would pause anyway. That is the whole point.
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/rest/v1/recipes')
    expect(url).not.toContain('/auth/v1/health')
  })

  it('does not throw when Supabase is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(keepDatabaseAwake(env())).resolves.toBeUndefined()
  })
})

describe('backupToR2', () => {
  it('writes both tables under a dated key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          jsonResponse(url.includes('recipe_shares') ? [{ id: 9 }] : [{ id: 1 }, { id: 2 }]),
        ),
      ),
    )
    const { bucket, put } = bucketSpy()
    // A date deliberately unlike today's, so the assertion cannot pass by
    // coincidence on the day it happens to be run.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2031-02-07T03:30:00Z'))

    await backupToR2(env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key', BACKUPS: bucket }))

    const [key, body] = put.mock.calls[0]
    expect(key).toBe('recipes/2031-02-07.json')
    const parsed = JSON.parse(body as string)
    expect(parsed.tables.recipes).toHaveLength(2)
    expect(parsed.tables.recipe_shares).toHaveLength(1)
  })

  it('reads with the service role, not the anon key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    const { bucket } = bucketSpy()

    await backupToR2(env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key', BACKUPS: bucket }))

    // With the anon key RLS returns an empty array — a backup that looks like it
    // worked and restores nothing.
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.apikey).toBe('service-key')
  })

  it('pages until a short page, so a full first page is not the whole backup', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse([{ id: 1000 }]))
      .mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    const { bucket, put } = bucketSpy()

    await backupToR2(env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key', BACKUPS: bucket }))

    expect(String(fetchMock.mock.calls[1][0])).toContain('offset=1000')
    expect(JSON.parse(put.mock.calls[0][1] as string).tables.recipes).toHaveLength(1001)
  })

  it('skips without writing when the secret or the binding is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { bucket, put } = bucketSpy()

    await backupToR2(env({ BACKUPS: bucket }))
    await backupToR2(env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('swallows a Supabase failure instead of writing a truncated backup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    const { bucket, put } = bucketSpy()

    await expect(
      backupToR2(env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key', BACKUPS: bucket })),
    ).resolves.toBeUndefined()
    expect(put).not.toHaveBeenCalled()
  })
})

describe('failoverStalePendingShares (#580 phase 3)', () => {
  function failoverEnv(overrides: Partial<CronEnv> = {}): CronEnv {
    return env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key', INNGEST_EVENT_KEY_2: 'evt-key-2', ...overrides })
  }

  it('skips when the secondary event key or the service role is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(failoverStalePendingShares(env({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' }))).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('re-sends a stale pending share to the secondary account and marks it secondary', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      if (String(url).includes('inn.gs')) return Promise.resolve(jsonResponse({ status: 200, ids: ['e1'] }))
      if (init?.method === 'PATCH') return Promise.resolve(jsonResponse(null))
      // The candidate query (a GET, so no init.method).
      return Promise.resolve(
        jsonResponse([
          { id: 7, shared_url: 'https://example.com/x', share_intent: { title: 'X', sourceType: 'youtube' }, user_id: 'u1' },
        ]),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await failoverStalePendingShares(failoverEnv())

    const query = calls.find((c) => c.url.includes('/rest/v1/recipe_shares') && c.init?.method === undefined)
    expect(query?.url).toContain('status=eq.pending')
    expect(query?.url).toContain('inngest_account=eq.primary')

    const send = calls.find((c) => c.url.includes('inn.gs'))
    expect(send?.url).toContain('/e/evt-key-2')
    expect(JSON.parse(String(send?.init?.body))[0]).toMatchObject({
      name: 'recipe/extract',
      data: { shareId: 7, sourceType: 'youtube', userId: 'u1' },
    })

    const patch = calls.find((c) => c.init?.method === 'PATCH')
    expect(patch?.url).toContain('id=eq.7')
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ inngest_account: 'secondary' })
  })

  it('does not throw when the candidate query fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    await expect(failoverStalePendingShares(failoverEnv())).resolves.toBeUndefined()
  })

  it('uses the configured window to pick the cutoff', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2031-02-07T12:00:00Z'))
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        urls.push(String(url))
        return Promise.resolve(jsonResponse([]))
      }),
    )
    await failoverStalePendingShares(failoverEnv({ INNGEST_FAILOVER_WINDOW_MINUTES: '30' }))
    // 30 minutes before 12:00 is 11:30.
    expect(urls[0]).toContain(encodeURIComponent('2031-02-07T11:30:00.000Z'))
  })
})
