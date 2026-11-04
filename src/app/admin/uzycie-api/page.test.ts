import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['admin_api_usage', 'admin_api_usage'])
    expect(rpc.mock.calls.map((c) => c[1])).toEqual([{ p_days: 7 }, { p_days: 28 }])
  })

  it('renders the empty state when nothing was counted', async () => {
    const empty = { days: 7, since: '2026-10-29', totals: [], daily: [] }
    const rpc = vi.fn().mockResolvedValue({ data: empty, error: null })
    vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc } } as never)
    const tree = JSON.stringify(await ApiUsagePage())
    expect(tree).not.toContain('Nie udało się wczytać')
  })
})
