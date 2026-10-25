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
  for (const m of ['select', 'eq', 'contains', 'order', 'range', 'not', 'neq', 'limit']) builder[m] = () => builder
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
  getCategoryListing,
  getCategoryFacets,
  getCategoryTotal,
  getPublicRecipe,
  getRecentPublicRecipes,
  getRecipeOfTheDay,
  readCategoryListing,
  readCategoryFacets,
  readCategoryTotal,
  readPublicRecipe,
  readRecentPublicRecipes,
  readRecipeOfTheDay,
} from './recipe-cache'

/** A fake Supabase client whose chain resolves to `many` (awaited) / `single` (maybeSingle). */
function fakeClient(opts: { many?: unknown; single?: unknown; rpc?: unknown } = {}) {
  const selectCols: string[] = []
  const fromTables: string[] = []
  const makeBuilder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['eq', 'contains', 'order', 'range', 'not', 'neq', 'limit']) b[m] = () => b
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
  return { client: client as never, selectCols, fromTables }
}

describe('cached wrappers — TTL, tags, and viewer-independent keys', () => {
  beforeEach(() => {
    cacheCalls.length = 0
  })

  it('getCategoryListing: keyed by category/tags/limit only, 120 s TTL, list tag', async () => {
    await getCategoryListing({ category: 'obiady', tags: ['szybkie', 'tanie'], limit: 24 })
    const { keyParts, options } = cacheCalls[0]
    expect(keyParts).toEqual(['category-listing', 'obiady', 'szybkie,tanie', '24'])
    expect(options).toEqual({ revalidate: 120, tags: [RECIPES_LIST_TAG] })
    // No key part looks like a user id / cookie — nothing viewer-specific is cached.
    expect(keyParts.join('|')).not.toMatch(/user|cookie|session/i)
  })

  it('getCategoryListing: tag order does not change the key (sorted)', async () => {
    await getCategoryListing({ category: 'obiady', tags: ['tanie', 'szybkie'], limit: 24 })
    expect(cacheCalls[0].keyParts).toEqual(['category-listing', 'obiady', 'szybkie,tanie', '24'])
  })

  it('getCategoryFacets / getCategoryTotal carry the 120 s TTL + list tag', async () => {
    await getCategoryFacets({ category: 'obiady', selected: ['tanie', 'szybkie'] })
    await getCategoryTotal({ category: 'obiady' })
    expect(cacheCalls[0].keyParts).toEqual(['category-facets', 'obiady', 'szybkie,tanie'])
    expect(cacheCalls[1].keyParts).toEqual(['category-total', 'obiady'])
    for (const c of cacheCalls) expect(c.options).toEqual({ revalidate: 120, tags: [RECIPES_LIST_TAG] })
  })

  it('getPublicRecipe: keyed by slug, tagged with the recipe tag + list tag', async () => {
    await getPublicRecipe('sernik-wiedenski')
    expect(cacheCalls[0].keyParts).toEqual(['public-recipe', 'sernik-wiedenski'])
    expect(cacheCalls[0].options).toEqual({
      revalidate: 120,
      tags: [RECIPES_LIST_TAG, recipeTag('sernik-wiedenski')],
    })
  })

  it('getRecentPublicRecipes: keyed by limit only', async () => {
    await getRecentPublicRecipes(4)
    expect(cacheCalls[0].keyParts).toEqual(['recent-public-recipes', '4'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 120, tags: [RECIPES_LIST_TAG] })
  })

  it('getRecipeOfTheDay: keyed by the Warsaw civil day (stable within a day)', async () => {
    await getRecipeOfTheDay(new Date('2026-10-25T09:00:00Z'))
    expect(cacheCalls[0].keyParts).toEqual(['recipe-of-the-day', '2026-10-25'])
    expect(cacheCalls[0].options).toEqual({ revalidate: 120, tags: [RECIPES_LIST_TAG] })
  })
})

describe('revalidateRecipeCaches', () => {
  beforeEach(() => vi.mocked(revalidateTag).mockClear())

  it('purges the list tag immediately (expire: 0), no recipe tag without a slug', () => {
    revalidateRecipeCaches()
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith(RECIPES_LIST_TAG, { expire: 0 })
  })

  it('also purges the per-recipe tag when a slug is given', () => {
    revalidateRecipeCaches('sernik-wiedenski')
    expect(revalidateTag).toHaveBeenCalledWith(RECIPES_LIST_TAG, { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith(recipeTag('sernik-wiedenski'), { expire: 0 })
  })
})

describe('reads — public_recipes only, no user-scoped columns (no cross-user leakage)', () => {
  it('readCategoryListing returns rows + count and selects no user_id', async () => {
    const { client, selectCols, fromTables } = fakeClient({ many: { data: [{ id: 1 }], count: 7, error: null } })
    const out = await readCategoryListing(client, { category: 'obiady', tags: [], limit: 24 })
    expect(out).toEqual({ recipes: [{ id: 1 }], count: 7 })
    expect(fromTables).toEqual(['public_recipes'])
    expect(selectCols.join(' ')).not.toContain('user_id')
  })

  it('readCategoryFacets passes selected tags to the RPC and returns the counters', async () => {
    const { client } = fakeClient({ rpc: { data: [{ tag: 'tanie', count: 3 }], error: null } })
    const out = await readCategoryFacets(client, { category: 'obiady', selected: ['tanie'] })
    expect(out).toEqual([{ tag: 'tanie', count: 3 }])
  })

  it('readCategoryTotal returns the head count', async () => {
    const { client } = fakeClient({ many: { count: 42, error: null } })
    expect(await readCategoryTotal(client, { category: 'obiady' })).toBe(42)
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
