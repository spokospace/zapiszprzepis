import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))
vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))
vi.mock('@/lib/recipe-dedup', () => ({
  findExistingRecipeForUrl: vi.fn(),
}))
vi.mock('@/lib/detect-source-type', () => ({
  detectSourceType: vi.fn().mockReturnValue('web_blog'),
}))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { findExistingRecipeForUrl } from '@/lib/recipe-dedup'
import { triggerRecipeExtraction } from '@/app/share/actions'

describe('triggerRecipeExtraction — send-failure marks share failed (Risk 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates share to status:failed when inngest.send() throws', async () => {
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq })

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 42 }, error: null }),
          }),
        }),
        update: updateFn,
      })),
    }

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue({
      status: 'new',
      normalizedUrl: 'https://example.com/recipe',
    })
    vi.mocked(inngest.send).mockRejectedValue(new Error('queue down'))

    await triggerRecipeExtraction('https://example.com/recipe')

    expect(updateFn).toHaveBeenCalledWith({
      status: 'failed',
      error_message: 'Failed to queue extraction',
    })
    expect(updateEq).toHaveBeenCalledWith('id', 42)
  })

  it('still returns a share result even when inngest.send() throws', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
    }

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue({
      status: 'new',
      normalizedUrl: 'https://example.com/recipe',
    })
    vi.mocked(inngest.send).mockRejectedValue(new Error('queue down'))

    const result = await triggerRecipeExtraction('https://example.com/recipe')

    expect(result).toMatchObject({ shareId: 99 })
  })
})
