import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Capture every unstable_cache(fn, keyParts, options) call, then invoke fn so the
// wrapper still resolves. This lets us assert the TTL, the tags, and that the
// cache KEY carries no per-viewer input (the cross-user-safety guarantee).
const cacheCalls: { keyParts: string[]; options: { revalidate?: number; tags?: string[] } }[] = []
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keyParts: string[], options: unknown) => {
    cacheCalls.push({ keyParts, options: options as { revalidate?: number; tags?: string[] } })
    return fn
  },
  revalidateTag: vi.fn(),
}))

// A benign anon client so the wrappers resolve without a real DB.
vi.mock('@/lib/supabase/anon', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'or', 'contains', 'overlaps', 'order', 'range', 'not', 'neq', 'limit']) builder[m] = () => builder
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
  builder.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(res)
  const client = { from: () => builder, rpc: () => Promise.resolve({ data: [], error: null }) }
  return { createSupabaseAnonClient: () => client }
})

import { revalidateTag } from 'next/cache'
import {
  RECIPES_LIST_TAG,
  recipeTag,
  revalidateRecipeCaches,
  getCategoryCards,
  getPublicRecipe,
  getRecentPublicRecipes,
  getRecipeOfTheDay,
  getSimilarRecipes,
  readCategoryCards,
  readPublicRecipe,
  readRecentPublicRecipes,
  readRecipeOfTheDay,
  readSimilarRecipes,
} from './recipe-cache'

/** A fake Supabase client whose chain resolves to `many` (awaited) / `single` (maybeSingle). */
function fakeClient(opts: { many?: unknown; single?: unknown; rpc?: unknown } = {}) {
  const selectCols: string[] = []
  const fromTables: string[] = []
  const orFilters: string[] = []
  const makeBuilder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['eq', 'contains', 'overlaps', 'order', 'range', 'not', 'neq', 'limit']) b[m] = () => b
    b.or = (filter: string) => {
      orFilters.push(filter)
      return b
    }
    b.select = (cols: string) => {
      selectCols.push(cols)
      return b
    }
    b.maybeSingle = () => Promise.resolve(opts.single ?? { data: null, error: null })
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(opts.many ?? { data: [], count: 0, error: null }).then(res, rej)
    return b
  }
  const client = {
    from: (t: string) => {
      fromTables.push(t)
      return makeBuilder()
    },
    rpc: () => Promise.resolve(opts.rpc ?? { data: [], error: null }),
  }
  return { client: client as never, selectCols, fromTables, orFilters }
}

describe('cached wrappers — TTL, tags, and viewer-independent keys', () => {
  beforeEach(() => {
    cacheCalls.length = 0
  })

  it('getCategoryCards: keyed by category only, 1 h TTL, list tag', async () => {
    await getCategoryCards('obiady')
    const { keyParts, options } = cacheCalls[0]
    expect(keyParts).toEqual(['category-cards', 'obiady'])
    expect(options).toEqual({ revalidate: 3600, tags: [RECIPES_LIST_TAG] })
    // No key part looks like a user id / cookie — nothing viewer-specific is cached.
    expect(keyParts.join('|')).not.toMatch(/user|cookie|session/i)
  })


  it('getPublicRecipe: keyed by slug, tagged with its own tag only, so an import does not purge it', async () => {
    await getPublicRecipe('sernik-wiedenski')
    expect(cacheCalls[0].keyParts).toEqual(['public-recipe', 'sernik-wiedenski'])
    expect(cacheCalls[0].options).toEqual({
      revalidate: 3600,
      tags: [recipeTag('sernik-wiedenski')],
    })
  })

  it('getSimilarRecipes: keyed by what the ranking reads, tag order ignored, list tag', async () => {
    await getSimilarRecipes({ id: 5, category: 'ciasta', tags: ['tanie', 'szybkie'], dish: 'sernik' })
    await getSimilarRecipes({ id: 5, category: 'ciasta', tags: ['szybkie', 'tanie'] })
    expect(cacheCalls[0].keyParts).toEqual(['similar-recipes', '5', 'ciasta', 'sernik', 'szybkie,tanie'])
    expect(cacheCalls[1].keyParts).toEqual(['similar-recipes', '5', 'ciasta', '', 'szybkie,tanie'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: [RECIPES_LIST_TAG] })
  })

  it('getRecentPublicRecipes: keyed by limit only', async () => {
    await getRecentPublicRecipes(4)
    expect(cacheCalls[0].keyParts).toEqual(['recent-public-recipes', '4'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: [RECIPES_LIST_TAG] })
  })

  it('getRecipeOfTheDay: keyed by the Warsaw civil day (stable within a day)', async () => {
    await getRecipeOfTheDay(new Date('2026-10-25T09:00:00Z'))
    expect(cacheCalls[0].keyParts).toEqual(['recipe-of-the-day', '2026-10-25'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 3600, tags: [RECIPES_LIST_TAG] })
  })
})

describe('revalidateRecipeCaches', () => {
  beforeEach(() => vi.mocked(revalidateTag).mockClear())

  it('purges the list tag immediately (expire: 0), no recipe tag without a slug', () => {
    revalidateRecipeCaches()
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith(RECIPES_LIST_TAG, { expire: 0 })
  })

  it('purges the tag of every slug given', () => {
    revalidateRecipeCaches('sernik', 'makowiec')
    expect(revalidateTag).toHaveBeenCalledTimes(3)
    expect(revalidateTag).toHaveBeenCalledWith(recipeTag('sernik'), { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith(recipeTag('makowiec'), { expire: 0 })
  })

  it('also purges the per-recipe tag when a slug is given', () => {
    revalidateRecipeCaches('sernik-wiedenski')
    expect(revalidateTag).toHaveBeenCalledWith(RECIPES_LIST_TAG, { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith(recipeTag('sernik-wiedenski'), { expire: 0 })
  })

  it('logs instead of throwing when the invalidation fails — the write it follows already succeeded', () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('no Next request context')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => revalidateRecipeCaches('sernik-wiedenski')).not.toThrow()
    expect(consoleError).toHaveBeenCalledWith('[recipe-cache] invalidation failed:', 'no Next request context')
    consoleError.mockRestore()
  })
})

describe('reads — public_recipes only, no user-scoped columns (no cross-user leakage)', () => {
  it('readCategoryCards returns the rows and selects no user_id', async () => {
    const { client, selectCols, fromTables, orFilters } = fakeClient({ many: { data: [{ id: 1 }], error: null } })
    expect(await readCategoryCards(client, 'obiady')).toEqual([{ id: 1 }])
    // The list holds the recipes whose primary OR extra category is this one (#689).
    expect(orFilters).toEqual(['category.eq.obiady,extra_categories.cs.{obiady}'])
    expect(fromTables).toEqual(['public_recipes'])
    expect(selectCols.join(' ')).not.toContain('user_id')
  })


  it('readPublicRecipe returns the first (oldest) row or null', async () => {
    const hit = fakeClient({ many: { data: [{ id: 9, slug: 's' }], error: null } })
    expect(await readPublicRecipe(hit.client, 's')).toEqual({ id: 9, slug: 's' })
    expect(hit.fromTables).toEqual(['public_recipes'])
    const miss = fakeClient({ many: { data: [], error: null } })
    expect(await readPublicRecipe(miss.client, 'nope')).toBeNull()
  })

  it('readPublicRecipe throws on a DB error (so a failure is never cached)', async () => {
    const { client } = fakeClient({ many: { data: null, error: { message: 'boom' } } })
    await expect(readPublicRecipe(client, 's')).rejects.toThrow('recipe read failed')
  })

  it('readSimilarRecipes ranks shared tags first and returns the category total', async () => {
    const rows = [{ id: 1, tags: ['tanie'] }, { id: 2, tags: ['szybkie'] }]
    const { client, fromTables, selectCols } = fakeClient({ many: { data: rows, count: 12, error: null } })
    const out = await readSimilarRecipes(client, { id: 9, category: 'ciasta', tags: ['szybkie'] })
    expect(out.cards.map((c) => c.id)).toEqual([2, 1])
    expect(out.total).toBe(12)
    expect(new Set(fromTables)).toEqual(new Set(['public_recipes']))
    expect(selectCols.join(' ')).not.toContain('user_id')
  })

  it('readSimilarRecipes leaves out the other versions of a dish', async () => {
    const { client, orFilters } = fakeClient({ many: { data: [], count: 0, error: null } })
    await readSimilarRecipes(client, { id: 9, category: 'ciasta', tags: [], dish: 'sernik' })
    expect(orFilters).toEqual(['dish.is.null,dish.neq."sernik"'])
  })

  it('readSimilarRecipes throws on a DB error (so a failure is never cached)', async () => {
    const { client } = fakeClient({ many: { data: null, error: { message: 'boom' } } })
    await expect(readSimilarRecipes(client, { id: 9, category: 'ciasta', tags: [] })).rejects.toThrow('similar recipes failed')
  })

  it('readRecentPublicRecipes returns the feed and selects no user_id', async () => {
    const { client, selectCols } = fakeClient({ many: { data: [{ id: 1 }, { id: 2 }], error: null } })
    expect(await readRecentPublicRecipes(client, 4)).toEqual([{ id: 1 }, { id: 2 }])
    expect(selectCols.join(' ')).not.toContain('user_id')
  })

  it('readRecipeOfTheDay picks one row from the pool for the day', async () => {
    const { client } = fakeClient({ many: { data: [{ id: 10 }, { id: 11 }], error: null }, single: { data: { id: 11 }, error: null } })
    expect(await readRecipeOfTheDay(client, new Date('2026-10-25T09:00:00Z'))).toEqual({ id: 11 })
  })

  it('readRecipeOfTheDay returns null for an empty pool', async () => {
    const { client } = fakeClient({ many: { data: [], error: null } })
    expect(await readRecipeOfTheDay(client, new Date())).toBeNull()
  })
})
