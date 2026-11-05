import { describe, it, expect, vi, beforeEach } from 'vitest'

// React cache() memoizes per render; as identity here each call re-runs.
vi.mock('react', () => ({ cache: <T,>(fn: T): T => fn }))

const getPublicRecipe = vi.fn()
vi.mock('@/lib/recipe-cache', () => ({ getPublicRecipe }))
const resolveHiddenRecipe = vi.fn()
vi.mock('@/lib/hidden-recipe', () => ({ resolveHiddenRecipe }))

const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ getCurrentUser, createSupabaseServerClient: async () => ({}) }))

const { loadRecipe } = await import('./load-recipe')

// The one object the cached, user-independent public read returns.
const RECIPE = { id: 9, slug: 'sernik' }

beforeEach(() => {
  getPublicRecipe.mockReset().mockResolvedValue(RECIPE)
  getCurrentUser.mockReset()
  resolveHiddenRecipe.mockReset().mockResolvedValue(null)
})

describe('loadRecipe — one public read for every reader', () => {
  it('serves the cached row without touching the session', async () => {
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBe(RECIPE)
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('surfaces a thrown read as error (logged before 404), recipe null', async () => {
    getPublicRecipe.mockRejectedValue(new Error('boom'))
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBeNull()
    expect(r.error).toBeInstanceOf(Error)
    expect(getCurrentUser).not.toHaveBeenCalled()
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
    await loadRecipe('sernik')
    expect(resolveHiddenRecipe).not.toHaveBeenCalled()
  })

  it('a signed-in visitor of a missing public row is checked once; staff then get the recipe itself', async () => {
    getCurrentUser.mockResolvedValue({ id: 'staff' })
    getPublicRecipe.mockResolvedValue(null)
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
    resolveHiddenRecipe.mockResolvedValue({ kind: 'unavailable' })
    const r = await loadRecipe('sernik')
    expect(r.recipe).toBeNull()
    expect(r.hidden).toEqual({ kind: 'unavailable' })
  })

  it('a failed public read is an error, not a hidden recipe', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-a' })
    getPublicRecipe.mockRejectedValue(new Error('boom'))
    const r = await loadRecipe('sernik')
    expect(r.error).toBeInstanceOf(Error)
    expect(resolveHiddenRecipe).not.toHaveBeenCalled()
  })
})
