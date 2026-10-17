import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect() ends the action by throwing, as Next's does.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/lib/recipe-dedup', () => ({ findExistingRecipeForUrl: vi.fn() }))
vi.mock('@/lib/intake-favorite', () => ({ favoriteExistingRecipe: vi.fn() }))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn().mockResolvedValue(true), NO_FULL_ACCESS: 'No full access' }))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { findExistingRecipeForUrl } from '@/lib/recipe-dedup'
import { favoriteExistingRecipe } from '@/lib/intake-favorite'
import { getFullAccess } from '@/lib/full-access'
import { addRecipeFromUrl } from './add-recipe-action'

const URL_IN = 'https://example.com/tiramisu'
const OTHER = { status: 'other' as const, recipeId: 7, slug: 'tiramisu', normalizedUrl: URL_IN }

function form(url: string) {
  const data = new FormData()
  data.set('url', url)
  return data
}

describe('addRecipeFromUrl — one recipe per link (E01-S03a)', () => {
  const from = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as any)
  })

  it('favorites someone else’s recipe and opens it with the in_favorites toast', async () => {
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue(OTHER)

    await expect(addRecipeFromUrl(form(URL_IN))).rejects.toThrow('REDIRECT /przepis/tiramisu?in_favorites=1')

    expect(favoriteExistingRecipe).toHaveBeenCalledWith(expect.anything(), 'user-1', 7, URL_IN)
    expect(from).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('reports a server error when the favorite cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue(OTHER)
    vi.mocked(favoriteExistingRecipe).mockRejectedValue(new Error('db down'))

    await expect(addRecipeFromUrl(form(URL_IN))).rejects.toThrow('REDIRECT /?add_error=server')
  })

  it('still says "you already have it" for the user’s own recipe', async () => {
    vi.mocked(findExistingRecipeForUrl).mockResolvedValue({ status: 'completed', slug: 'tiramisu', normalizedUrl: URL_IN })

    await expect(addRecipeFromUrl(form(URL_IN))).rejects.toThrow('REDIRECT /przepis/tiramisu?duplicate=1')
    expect(favoriteExistingRecipe).not.toHaveBeenCalled()
  })
})

describe('addRecipeFromUrl — full-access gate (E01-S11)', () => {
  const from = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as any)
  })

  it('sends a user without full access to the code gate before any dedup or insert', async () => {
    vi.mocked(getFullAccess).mockResolvedValueOnce(false)

    await expect(addRecipeFromUrl(form(URL_IN))).rejects.toThrow('REDIRECT /?add_error=no_access')

    expect(findExistingRecipeForUrl).not.toHaveBeenCalled()
    expect(favoriteExistingRecipe).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('still sends a guest to login first', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    } as any)

    await expect(addRecipeFromUrl(form(URL_IN))).rejects.toThrow('REDIRECT /login')
    expect(getFullAccess).not.toHaveBeenCalled()
  })
})
