import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
const deleteEqRecipe = vi.fn()
const deleteEqUser = vi.fn(() => ({ eq: deleteEqRecipe }))
const getUser = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    from: () => ({ insert, delete: () => ({ eq: deleteEqUser }) }),
  }),
}))

const { addFavorite, removeFavorite } = await import('./actions')

const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('addFavorite', () => {
  it('rejects an invalid id without touching the database', async () => {
    expect(await addFavorite('abc')).toEqual({ ok: false, error: 'invalid' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await addFavorite(5)).toEqual({ ok: false, error: 'unauthenticated' })
    expect(insert).not.toHaveBeenCalled()
  })

  it("inserts the caller's own favorite", async () => {
    signedIn()
    insert.mockResolvedValue({ error: null })
    expect(await addFavorite('5')).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', recipe_id: 5 })
  })

  it('treats an existing favorite (unique_violation) as success — idempotent', async () => {
    signedIn()
    insert.mockResolvedValue({ error: { code: '23505' } })
    expect(await addFavorite(5)).toEqual({ ok: true })
  })

  it('reports other database errors', async () => {
    signedIn()
    insert.mockResolvedValue({ error: { code: '42501' } })
    expect(await addFavorite(5)).toEqual({ ok: false, error: 'failed' })
  })
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
