import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/lib/recipe-image-archive', () => ({
  removeRecipeImages: vi.fn(),
}))
vi.mock('@/lib/recipe-cache', () => ({ revalidateRecipeCaches: vi.fn() }))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { removeRecipeImages } from '@/lib/recipe-image-archive'
import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import { RECIPE_SHARED_MESSAGE } from '@/lib/recipe-delete'
import { POST } from './route'

const SHARED = { code: 'P0001', message: 'recipe_shared' }

/** A signed-in owner's client; `deleteError` is what the row DELETE answers. */
function mockClient(deleteError: { code: string; message: string } | null) {
  const steps: string[] = []
  const lookup = {
    select: () => lookup,
    eq: () => lookup,
    single: async () => ({ data: { id: 1, user_id: 'user-1', image_url: 'https://cdn/cover.jpg' }, error: null }),
    delete: () => ({
      eq: async () => {
        steps.push('row')
        return { error: deleteError }
      },
    }),
  }
  const remove = vi.mocked(removeRecipeImages).mockImplementation(async () => {
    steps.push('storage')
  })
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: () => lookup,
  } as any)
  return { steps, remove }
}

function deleteRequest(accept?: string) {
  const body = new FormData()
  body.set('slug', 'tiramisu')
  return new NextRequest('http://localhost/api/recipes/delete', {
    method: 'POST',
    body,
    headers: accept ? { accept } : {},
  })
}

describe('POST /api/recipes/delete — a recipe others keep as a favorite (E01-S03a)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('answers 409 with the message when the guard refuses, leaving storage untouched', async () => {
    const { remove } = mockClient(SHARED)

    const response = await POST(deleteRequest('application/json'))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'recipe_shared', message: RECIPE_SHARED_MESSAGE })
    expect(remove).not.toHaveBeenCalled()
    // A refused delete leaves the caches alone — nothing changed.
    expect(revalidateRecipeCaches).not.toHaveBeenCalled()
  })

  it("sends the recipe page's plain form back to the recipe with the inline message", async () => {
    const { remove } = mockClient(SHARED)

    const response = await POST(deleteRequest('text/html,application/xhtml+xml'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/przepis/tiramisu?delete_error=shared')
    expect(remove).not.toHaveBeenCalled()
  })

  it('deletes the row first and cleans up storage only after it is gone', async () => {
    const { steps } = mockClient(null)

    const response = await POST(deleteRequest('text/html'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/recipes')
    expect(steps).toEqual(['row', 'storage'])
    // Cover, gallery and step photos go in one remove that checks what Storage really deleted (#132).
    expect(removeRecipeImages).toHaveBeenCalledWith(expect.anything(), 'user-1', 1, 'https://cdn/cover.jpg')
    // The public list + this recipe's cached page are purged (#445).
    expect(revalidateRecipeCaches).toHaveBeenCalledWith('tiramisu')
  })

  it('keeps any other database failure a 500, with storage untouched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { remove } = mockClient({ code: '57014', message: 'canceling statement due to statement timeout' })

    const response = await POST(deleteRequest('text/html'))

    expect(response.status).toBe(500)
    expect(remove).not.toHaveBeenCalled()
  })
})
