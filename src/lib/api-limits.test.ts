import { describe, it, expect, vi } from 'vitest'
import { fetchFirecrawlLimit, limitLevel, usedShare } from './api-limits'
import { syncApiLimits } from './worker-cron'

type Call = (url: string, init?: RequestInit) => Promise<Response>
const ok = (data: unknown) => vi.fn<Call>(async () => Response.json(data))

describe('fetchFirecrawlLimit', () => {
  it('reads remaining and plan credits with the bearer key', async () => {
    const fetchFn = ok({ success: true, data: { remainingCredits: 640, planCredits: 1000, billingPeriodEnd: '2026-11-30T23:59:59Z' } })
    const limit = await fetchFirecrawlLimit('fc-key', fetchFn)
    expect(limit).toEqual({ service: 'firecrawl', remaining: 640, total: 1000, unit: 'kredytów', period_end: '2026-11-30T23:59:59.000Z' })
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.firecrawl.dev/v2/team/credit-usage')
    expect((fetchFn.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer fc-key')
  })
  it('keeps a missing or invalid period end as null', async () => {
    const limit = await fetchFirecrawlLimit('k', ok({ data: { remainingCredits: 1, planCredits: 2, billingPeriodEnd: 'soon' } }))
    expect(limit.period_end).toBeNull()
  })
  it('throws on a failed call or an unexpected shape', async () => {
    await expect(fetchFirecrawlLimit('k', vi.fn(async () => new Response(null, { status: 402 })))).rejects.toThrow('402')
    await expect(fetchFirecrawlLimit('k', ok({ data: { remainingCredits: -1, planCredits: 5 } }))).rejects.toThrow('unexpected')
    await expect(fetchFirecrawlLimit('k', ok(null))).rejects.toThrow('unexpected')
  })
})

describe('limitLevel', () => {
  it('is warn from 80 % used and critical from 95 %', () => {
    expect(limitLevel(500, 1000)).toBe('ok')
    expect(limitLevel(201, 1000)).toBe('ok')
    expect(limitLevel(200, 1000)).toBe('warn')
    expect(limitLevel(50, 1000)).toBe('critical')
    expect(limitLevel(0, 1000)).toBe('critical')
  })
  it('is ok when the plan size is unknown', () => {
    expect(limitLevel(0, 0)).toBe('ok')
    expect(usedShare(0, 0)).toBeNull()
    expect(usedShare(5000, 1000)).toBe(0)
  })
})

describe('syncApiLimits', () => {
  const env = () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://db.example/',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    FIRECRAWL_API_KEY: 'fc',
  })

  it('skips without the Firecrawl key and never calls out', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn()
    await syncApiLimits({ ...env(), FIRECRAWL_API_KEY: undefined }, fetchFn)
    expect(fetchFn).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('skipped'))
  })

  it('upserts one snapshot row by service with the service key', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchFn = vi.fn<Call>(async (url) =>
      url.startsWith('https://api.firecrawl.dev')
        ? Response.json({ data: { remainingCredits: 10, planCredits: 100 } })
        : new Response(null, { status: 201 }),
    )
    await syncApiLimits(env(), fetchFn)
    const [url, init] = fetchFn.mock.calls[1]
    expect(url).toBe('https://db.example/rest/v1/api_limit_snapshots?on_conflict=service')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer service')
    expect((init?.headers as Record<string, string>).Prefer).toContain('merge-duplicates')
    expect(JSON.parse(String(init?.body))).toEqual([
      expect.objectContaining({ service: 'firecrawl', remaining: 10, total: 100, unit: 'kredytów' }),
    ])
  })

  it('writes nothing and does not throw when Firecrawl fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }))
    await expect(syncApiLimits(env(), fetchFn)).resolves.toBeUndefined()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('failed'))
  })
})
