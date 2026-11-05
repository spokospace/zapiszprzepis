import { describe, it, expect, vi, beforeEach } from 'vitest'

const deleteEqRecipe = vi.fn()
const deleteEqUser = vi.fn(() => ({ eq: deleteEqRecipe }))
const getUser = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    from: () => ({ delete: () => ({ eq: deleteEqUser }) }),
  }),
}))

const { removeFavorite } = await import('./actions')

const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('removeFavorite', () => {
  it("deletes only the caller's row for that recipe", async () => {
    signedIn()
    deleteEqRecipe.mockResolvedValue({ error: null })
    expect(await removeFavorite(5)).toEqual({ ok: true })
    expect(deleteEqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(deleteEqRecipe).toHaveBeenCalledWith('recipe_id', 5)
  })

  it('requires a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await removeFavorite(5)).toEqual({ ok: false, error: 'unauthenticated' })
  })
})
