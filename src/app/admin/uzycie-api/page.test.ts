import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))

import { requirePermission } from '@/lib/staff/context'
import ApiUsagePage from './page'

describe('API usage page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires analytics.read and does not query when the gate refuses', async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error('NOT_FOUND'))
    await expect(ApiUsagePage()).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith('analytics.read')
  })

  it('asks the database for the 7 and 28 day windows', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } })
    vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc } } as never)
    await ApiUsagePage()
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['admin_api_limits', 'admin_api_usage', 'admin_api_usage'])
    expect(rpc.mock.calls.map((c) => c[1])).toEqual([undefined, { p_days: 7 }, { p_days: 28 }])
  })

  it('shows a provider limit with its level in words, not only colour', async () => {
    const limit = { service: 'firecrawl', remaining: 100, total: 1000, unit: 'kredytów', period_end: null, fetched_at: '2026-11-04T04:00:00Z' }
    const empty = { days: 7, since: '2026-10-29', totals: [], daily: [] }
    const rpc = vi.fn(async (name: string) => ({ data: name === 'admin_api_limits' ? [limit] : empty, error: null }))
    vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc } } as never)
    const tree = renderToStaticMarkup(await ApiUsagePage())
    expect(tree).toContain('Zostało mało')
  })

  it('renders the empty state when nothing was counted', async () => {
    const empty = { days: 7, since: '2026-10-29', totals: [], daily: [] }
    const rpc = vi.fn(async (name: string) => ({ data: name === 'admin_api_limits' ? [] : empty, error: null }))
    vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc } } as never)
    const tree = renderToStaticMarkup(await ApiUsagePage())
    expect(tree).not.toContain('Nie udało się wczytać')
    expect(tree).toContain('Brak danych o limitach')
  })
})
