import { describe, it, expect, vi, beforeEach } from 'vitest'

// React cache() memoizes per render; as identity here each call re-runs.
vi.mock('react', () => ({ cache: <T,>(fn: T): T => fn }))

const getPublicRecipe = vi.fn()
vi.mock('@/lib/recipe-cache', () => ({ getPublicRecipe }))

const getCurrentUser = vi.fn()
const maybeSingle = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser,
  createSupabaseServerClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
  }),
}))

const { loadRecipe } = await import('./load-recipe')

// The one object the cached, user-independent public read returns.
const RECIPE = { id: 9, slug: 'sernik' }

beforeEach(() => {
  getPublicRecipe.mockReset().mockResolvedValue(RECIPE)
  getCurrentUser.mockReset()
  maybeSingle.mockReset()
})

describe('loadRecipe — viewer-independent public read, per-viewer owner flag', () => {
  it('the owner sees isOwner=true and the unchanged public row', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-a' })
    maybeSingle.mockResolvedValue({ data: { id: 9 } })
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBe(RECIPE)
    expect(r.isOwner).toBe(true)
  })

  it('a different signed-in viewer gets the SAME public row but isOwner=false', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-b' })
    maybeSingle.mockResolvedValue({ data: null })
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBe(RECIPE) // identical cached read — no per-user leakage
    expect(r.isOwner).toBe(false)
  })

  it('a guest reads the public row and runs no owner query', async () => {
    getCurrentUser.mockResolvedValue(null)
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBe(RECIPE)
    expect(r.isOwner).toBe(false)
    expect(r.user).toBeNull()
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('surfaces a thrown read as error (logged before 404), recipe null', async () => {
    getCurrentUser.mockResolvedValue(null)
    getPublicRecipe.mockRejectedValue(new Error('boom'))
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBeNull()
    expect(r.error).toBeInstanceOf(Error)
  })
})
