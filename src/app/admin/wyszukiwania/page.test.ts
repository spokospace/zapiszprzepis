import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: unknown; href: string }) => ({ children, href }) }))

import { requirePermission } from '@/lib/staff/context'
import SearchConsolePage from './page'

describe('Google searches page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires analytics.read and does not query when the gate refuses', async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error('NOT_FOUND'))
    await expect(SearchConsolePage()).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith('analytics.read')
  })

  it('asks the database for the 7 and 28 day windows', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } })
    vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc } } as never)
    await SearchConsolePage()
    expect(rpc.mock.calls.map((c) => c[1])).toEqual([{ p_days: 7 }, { p_days: 28 }])
  })
})
