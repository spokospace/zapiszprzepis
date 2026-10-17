import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn() }))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { getFullAccess } from '@/lib/full-access'
import { refreshRecipe } from './refresh-action'

describe('refreshRecipe — full-access gate (E01-S11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses re-extraction without full access, before touching recipes or shares', async () => {
    const from = vi.fn()
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as any)
    vi.mocked(getFullAccess).mockResolvedValue(false)
    const data = new FormData()
    data.set('slug', 'tiramisu')

    await expect(refreshRecipe(data)).rejects.toThrow('REDIRECT /przepis/tiramisu?refresh_error=no_access')

    expect(from).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })
})
