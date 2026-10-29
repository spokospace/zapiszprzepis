import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/inngest/send', () => ({ sendRecipeExtract: vi.fn() }))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn() }))
vi.mock('@/lib/extraction-rate-limit', () => ({ extractionAllowed: vi.fn().mockResolvedValue(true), EXTRACTION_RATE_LIMITED: 'Extraction rate limited' }))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendRecipeExtract } from '@/inngest/send'
import { getFullAccess } from '@/lib/full-access'
import { extractionAllowed } from '@/lib/extraction-rate-limit'
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
    expect(sendRecipeExtract).not.toHaveBeenCalled()
  })
})

describe('refreshRecipe — a share that could not be queued (#382)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks the new share failed when Inngest rejects the event, instead of leaving it pending', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const shareUpdate = vi.fn()
    const recipesQuery: any = {
      select: () => recipesQuery,
      eq: () => recipesQuery,
      single: async () => ({ data: { source_url: 'https://example.com/x' }, error: null }),
    }
    const sharesQuery: any = {
      insert: () => sharesQuery,
      select: () => sharesQuery,
      single: async () => ({ data: { id: 5 }, error: null }),
      update: (values: unknown) => ({
        eq: async (...args: unknown[]) => {
          shareUpdate(values, ...args)
          return { error: null }
        },
      }),
    }
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: (table: string) => (table === 'recipes' ? recipesQuery : sharesQuery),
    } as any)
    vi.mocked(getFullAccess).mockResolvedValue(true)
    vi.mocked(sendRecipeExtract).mockRejectedValue(new Error('Inngest 503'))
    const data = new FormData()
    data.set('slug', 'tiramisu')

    await expect(refreshRecipe(data)).rejects.toThrow('REDIRECT /przepis/tiramisu?refreshing=1')

    expect(shareUpdate).toHaveBeenCalledWith({ status: 'failed', error_message: 'Failed to queue extraction' }, 'id', 5)
  })
})


describe('refreshRecipe — per-account extraction cap (E02-S11-T04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('over the cap: asks to try later, with no share row and no event', async () => {
    const recipesQuery: any = {
      select: () => recipesQuery,
      eq: () => recipesQuery,
      single: async () => ({ data: { source_url: 'https://example.com/x' }, error: null }),
    }
    const from = vi.fn((table: string) => (table === 'recipes' ? recipesQuery : {}))
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as any)
    vi.mocked(getFullAccess).mockResolvedValue(true)
    vi.mocked(extractionAllowed).mockResolvedValueOnce(false)
    const data = new FormData()
    data.set('slug', 'tiramisu')

    await expect(refreshRecipe(data)).rejects.toThrow('REDIRECT /przepis/tiramisu?refresh_error=rate_limited')

    expect(extractionAllowed).toHaveBeenCalledWith('user-1')
    expect(from).not.toHaveBeenCalledWith('recipe_shares')
    expect(sendRecipeExtract).not.toHaveBeenCalled()
  })
})
