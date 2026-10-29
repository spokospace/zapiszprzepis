import { describe, it, expect, vi, beforeEach } from 'vitest'

// React cache() memoizes per render; as identity here each call re-runs.
vi.mock('react', () => ({ cache: <T,>(fn: T): T => fn }))

const getPublicRecipe = vi.fn()
vi.mock('@/lib/recipe-cache', () => ({ getPublicRecipe }))
const resolveHiddenRecipe = vi.fn()
vi.mock('@/lib/hidden-recipe', () => ({ resolveHiddenRecipe }))

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
  resolveHiddenRecipe.mockReset().mockResolvedValue(null)
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

describe('loadRecipe — a recipe staff hid', () => {
  it('a guest gets nothing and runs no hidden lookup (the 404)', async () => {
    getCurrentUser.mockResolvedValue(null)
    getPublicRecipe.mockResolvedValue(null)
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBeNull()
    expect(r.hidden).toBeNull()
    expect(resolveHiddenRecipe).not.toHaveBeenCalled()
  })

  it('a visible recipe never asks the hidden lookup', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-a' })
    maybeSingle.mockResolvedValue({ data: null })
    await loadRecipe('sernik')
    expect(resolveHiddenRecipe).not.toHaveBeenCalled()
  })

  it('a signed-in visitor of a missing public row is checked once; staff then get the recipe itself', async () => {
    getCurrentUser.mockResolvedValue({ id: 'staff' })
    getPublicRecipe.mockResolvedValue(null)
    maybeSingle.mockResolvedValue({ data: null })
    const staffRecipe = { id: 9, slug: 'sernik' }
    resolveHiddenRecipe.mockResolvedValue({ kind: 'staff', recipe: staffRecipe, hiddenReason: null, staffRecipeId: 9 })
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBe(staffRecipe)
    expect(r.hidden?.kind).toBe('staff')
    expect(resolveHiddenRecipe).toHaveBeenCalledTimes(1)
  })

  it('the owner or a favoriter gets "unavailable" and no recipe', async () => {
    getCurrentUser.mockResolvedValue({ id: 'owner' })
    getPublicRecipe.mockResolvedValue(null)
    maybeSingle.mockResolvedValue({ data: { id: 9 } })
    resolveHiddenRecipe.mockResolvedValue({ kind: 'unavailable' })
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBeNull()
    expect(r.hidden).toEqual({ kind: 'unavailable' })
  })

  it('a failed public read is an error, not a hidden recipe', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-a' })
    getPublicRecipe.mockRejectedValue(new Error('boom'))
    maybeSingle.mockResolvedValue({ data: null })
    const r = await loadRecipe('sernik')
    expect(r.error).toBeInstanceOf(Error)
    expect(resolveHiddenRecipe).not.toHaveBeenCalled()
  })
})
