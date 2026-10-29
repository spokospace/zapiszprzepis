import { describe, it, expect, vi } from 'vitest'
import { resolveHiddenRecipe, staffRowToPublicRecipe } from './hidden-recipe'

vi.mock('@/lib/recipe-cache', () => ({}))

const ROW = {
  id: 9,
  slug: 'sernik',
  title: 'Sernik',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-05T10:00:00Z',
  image_urls: ['a', 'b', 'c'],
  hidden_at: '2026-10-06T10:00:00Z',
  hidden_reason: 'spam',
  step_images: null,
}

/** A client where rpc answers per function name and the staff read returns `rows`. */
function client(opts: { staff?: boolean; unavailable?: boolean; rows?: unknown[] }) {
  const from = vi.fn(() => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'order']) q[m] = () => q
    q.limit = async () => ({ data: opts.rows ?? [], error: null })
    return q
  })
  const rpc = vi.fn(async (fn: string) => ({
    data: fn === 'has_permission' ? (opts.staff ?? false) : (opts.unavailable ?? false),
    error: null,
  }))
  return { from, rpc, supabase: { from, rpc } as never }
}

describe('resolveHiddenRecipe', () => {
  it('gives staff the recipe, without the moderation columns, and the reason for the banner', async () => {
    const c = client({ staff: true, rows: [ROW] })
    const view = await resolveHiddenRecipe(c.supabase, 'sernik')
    expect(view?.kind).toBe('staff')
    if (view?.kind !== 'staff') return
    expect(view.hiddenReason).toBe('spam')
    expect(view.staffRecipeId).toBe(9)
    expect(view.recipe).toMatchObject({ slug: 'sernik', gallery_count: 3, last_modified: ROW.updated_at, author_name: null })
    expect(view.recipe).not.toHaveProperty('hidden_at')
    expect(view.recipe).not.toHaveProperty('image_urls')
    // Staff do not need the owner/favoriter check.
    expect(c.rpc).not.toHaveBeenCalledWith('recipe_hidden_for_viewer', expect.anything())
  })

  it('tells the owner or a favoriter the recipe is unavailable, without a word about the recipe', async () => {
    const c = client({ staff: false, unavailable: true })
    expect(await resolveHiddenRecipe(c.supabase, 'sernik')).toEqual({ kind: 'unavailable' })
    expect(c.from).not.toHaveBeenCalled()
    expect(c.rpc).toHaveBeenCalledWith('recipe_hidden_for_viewer', { p_slug: 'sernik' })
  })

  it('answers nothing (the 404) for a signed-in stranger', async () => {
    expect(await resolveHiddenRecipe(client({}).supabase, 'sernik')).toBeNull()
  })

  it('a staff member who finds no hidden row still gets the unavailable check (an own recipe of that slug)', async () => {
    const c = client({ staff: true, rows: [], unavailable: true })
    expect(await resolveHiddenRecipe(c.supabase, 'sernik')).toEqual({ kind: 'unavailable' })
  })

  it('fails closed: any error is "not visible", never a thrown 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = { rpc: vi.fn(async () => { throw new Error('network') }), from: vi.fn() } as never
    expect(await resolveHiddenRecipe(supabase, 'sernik')).toBeNull()
  })
})

describe('staffRowToPublicRecipe', () => {
  it('falls back to created_at when the row was never updated', () => {
    const recipe = staffRowToPublicRecipe({ ...ROW, updated_at: null } as never)
    expect(recipe.last_modified).toBe(ROW.created_at)
  })
})
