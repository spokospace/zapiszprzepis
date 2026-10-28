import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))
vi.mock('@/inngest/send', () => ({
  sendRecipeExtract: vi.fn(),
}))
vi.mock('@/lib/recipe-dedup', () => ({
  findExistingRecipeForUrl: vi.fn(),
}))
vi.mock('@/lib/detect-source-type', () => ({
  detectSourceType: vi.fn().mockReturnValue('web_blog'),
}))
vi.mock('@/lib/intake-favorite', () => ({
  favoriteExistingRecipe: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn().mockResolvedValue(true), NO_FULL_ACCESS: 'No full access' }))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendRecipeExtract } from '@/inngest/send'
import { findExistingRecipeForUrl } from '@/lib/recipe-dedup'
import { favoriteExistingRecipe } from '@/lib/intake-favorite'
import { getFullAccess } from '@/lib/full-access'
import { triggerRecipeExtraction } from '@/app/share/actions'

describe('triggerRecipeExtraction — a link someone else added first (E01-S03a)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds their recipe to favorites instead of extracting a copy', async () => {
    const from = vi.fn()
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as any)
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue({
      status: 'other',
      recipeId: 7,
      slug: 'tiramisu',
      normalizedUrl: 'https://example.com/tiramisu',
    })

    const result = await triggerRecipeExtraction('https://example.com/tiramisu')

    expect(result).toEqual({ duplicate: 'in_favorites', slug: 'tiramisu' })
    expect(favoriteExistingRecipe).toHaveBeenCalledWith(expect.anything(), 'user-1', 7, 'https://example.com/tiramisu')
    // No share row, no extraction: the recipe already exists.
    expect(from).not.toHaveBeenCalled()
    expect(sendRecipeExtract).not.toHaveBeenCalled()
  })
})

describe('triggerRecipeExtraction — send-failure marks share failed (Risk 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates share to status:failed when sendRecipeExtract() throws', async () => {
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
    vi.mocked(sendRecipeExtract).mockRejectedValue(new Error('queue down'))

    await triggerRecipeExtraction('https://example.com/recipe')

    expect(updateFn).toHaveBeenCalledWith({
      status: 'failed',
      error_message: 'Failed to queue extraction',
    })
    expect(updateEq).toHaveBeenCalledWith('id', 42)
  })

  it('still returns a share result even when sendRecipeExtract() throws', async () => {
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
    vi.mocked(sendRecipeExtract).mockRejectedValue(new Error('queue down'))

    const result = await triggerRecipeExtraction('https://example.com/recipe')

    expect(result).toMatchObject({ shareId: 99 })
  })
})

describe('triggerRecipeExtraction — full-access gate (E01-S11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses a new link from a user without full access before any insert', async () => {
    const from = vi.fn()
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as any)
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue({ status: 'new', normalizedUrl: 'https://example.com/tiramisu' })
    vi.mocked(getFullAccess).mockResolvedValueOnce(false)

    await expect(triggerRecipeExtraction('https://example.com/tiramisu')).rejects.toThrow('No full access')

    expect(from).not.toHaveBeenCalled()
    expect(sendRecipeExtract).not.toHaveBeenCalled()
  })
})
