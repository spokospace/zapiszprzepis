import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/env', () => ({ getExaApiKey: vi.fn().mockReturnValue('test-key') }))
vi.mock('@/lib/exa-rate-limit', () => ({ exaSearchAllowed: vi.fn() }))

import { requireUser } from '@/lib/supabase/server'
import { exaSearchAllowed } from '@/lib/exa-rate-limit'
import { searchViaExa } from './search-via-exa-action'

describe('searchViaExa — per-account cap', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ supabase: {}, user: { id: 'user-1' } } as any)
  })

  it('refuses over the cap before the paid Exa call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.mocked(exaSearchAllowed).mockResolvedValue(false)

    expect(await searchViaExa('tiramisu')).toEqual({ error: 'rate_limited' })
    expect(exaSearchAllowed).toHaveBeenCalledWith('user-1')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('searches for a signed-in account without full access', async () => {
    vi.mocked(exaSearchAllowed).mockResolvedValue(true)
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    expect(await searchViaExa('tiramisu')).toEqual({ results: [] })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
