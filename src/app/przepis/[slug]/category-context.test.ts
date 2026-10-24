import { describe, it, expect, vi } from 'vitest'
import { loadCategoryContext } from './category-context'
import { categoryLabel } from '@/lib/recipe-categories'
import { categoryPath } from '@/lib/routes'

// loadCategoryContext only ever calls supabase.rpc, so a bare { rpc } stands in
// for the client (same stub style as src/lib/search.test.ts).
function client(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

const ROW = {
  category: 'zupy',
  total: 18,
  idx: 3,
  prev: { slug: 'barszcz', title: 'Barszcz czerwony' },
  next: { slug: 'krem', title: 'Krem z pieczonej papryki' },
}

describe('loadCategoryContext (#464: one RPC)', () => {
  it('fetches the whole list-bar context in a single recipe_category_context call', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [ROW], error: null })
    await loadCategoryContext(client(rpc), { id: 42 })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('recipe_category_context', { p_id: 42 })
  })

  it('maps the row to a ListPosition, deriving label and href from the category', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [ROW], error: null })
    expect(await loadCategoryContext(client(rpc), { id: 42 })).toEqual({
      label: categoryLabel('zupy'),
      href: categoryPath('zupy'),
      index: 3,
      total: 18,
      prev: { slug: 'barszcz', title: 'Barszcz czerwony' },
      next: { slug: 'krem', title: 'Krem z pieczonej papryki' },
    })
  })

  it('passes null neighbours through unchanged (a list end)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...ROW, idx: 1, prev: null }], error: null })
    const pos = await loadCategoryContext(client(rpc), { id: 42 })
    expect(pos?.prev).toBeNull()
    expect(pos?.next).toEqual(ROW.next)
  })

  it('returns null when the recipe is not public (no row)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    expect(await loadCategoryContext(client(rpc), { id: 1 })).toBeNull()
  })

  it('returns null and logs when the RPC errors (e.g. not yet applied in the DB)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    expect(await loadCategoryContext(client(rpc), { id: 1 })).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('returns null when the RPC call throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockRejectedValue(new Error('network'))
    expect(await loadCategoryContext(client(rpc), { id: 1 })).toBeNull()
    spy.mockRestore()
  })
})
