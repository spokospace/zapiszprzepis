import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/env', () => ({ getExaApiKey: vi.fn().mockReturnValue('test-key') }))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn() }))

import { requireUser } from '@/lib/supabase/server'
import { getFullAccess } from '@/lib/full-access'
import { searchViaExa } from './search-via-exa-action'

describe('searchViaExa — full-access gate (E01-S11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ supabase: {}, user: { id: 'user-1' } } as any)
  })

  it('refuses without full access before the paid Exa call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.mocked(getFullAccess).mockResolvedValue(false)

    expect(await searchViaExa('tiramisu')).toEqual({ error: 'no_access' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
