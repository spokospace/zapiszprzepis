import { describe, expect, it } from 'vitest'
import { classifyExisting, findExistingRecipeForUrl, sameIngredients } from './recipe-dedup'

describe('sameIngredients', () => {
  it('ignores order, casing, spacing and repeats', () => {
    expect(sameIngredients([{ name: 'Mąka' }, { name: 'masło' }], [{ name: 'masło ' }, { name: 'mąka' }, { name: 'Masło' }])).toBe(true)
  })

  it('tells apart a variant that adds or swaps an ingredient', () => {
    expect(sameIngredients([{ name: 'mąka' }, { name: 'masło' }], [{ name: 'mąka' }, { name: 'margaryna' }])).toBe(false)
    expect(sameIngredients([{ name: 'mąka' }], [{ name: 'mąka' }, { name: 'cukier' }])).toBe(false)
  })
})

describe('classifyExisting — whose recipe a link already is', () => {
  it('is nobody’s when nothing matches', () => {
    expect(classifyExisting({ ownMatch: false, globalMatch: false })).toBe('none')
  })

  it('is the user’s own when they saved it, whatever else matches', () => {
    expect(classifyExisting({ ownMatch: true, globalMatch: false })).toBe('own')
    expect(classifyExisting({ ownMatch: true, globalMatch: true })).toBe('own')
  })

  it('is someone else’s when only a site-wide row matches', () => {
    expect(classifyExisting({ ownMatch: false, globalMatch: true })).toBe('other')
  })
})

type Call = { table: string; method: string; args: unknown[] }

/** A client whose lookups answer from `rows` (one row per table) and record every filter. */
function makeClient(rows: Record<string, unknown>) {
  const calls: Call[] = []
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'like', 'limit']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    chain.maybeSingle = async () => ({ data: rows[table] ?? null, error: null })
    return chain
  }
  return { client: { from } as never, calls }
}

const USER = 'user-1'

describe('findExistingRecipeForUrl — one recipe per link across the site', () => {
  it('reports the user’s own recipe without looking further', async () => {
    const { client, calls } = makeClient({ recipes: { id: 1, slug: 'placki' } })

    expect(await findExistingRecipeForUrl(client, USER, 'https://example.com/placki/')).toEqual({
      status: 'completed',
      slug: 'placki',
      normalizedUrl: 'https://example.com/placki',
    })
    expect(calls.some((c) => c.table === 'public_recipes')).toBe(false)
  })

  it('reports someone else’s recipe for the same link, read through public_recipes', async () => {
    const { client, calls } = makeClient({ public_recipes: { id: 7, slug: 'tiramisu' } })

    expect(await findExistingRecipeForUrl(client, USER, 'https://example.com/tiramisu?fbclid=abc')).toEqual({
      status: 'other',
      recipeId: 7,
      slug: 'tiramisu',
      normalizedUrl: 'https://example.com/tiramisu',
    })
    // The view has no user_id; only the own lookup is scoped to the user.
    expect(calls.filter((c) => c.table === 'public_recipes' && c.method === 'eq')).toEqual([
      { table: 'public_recipes', method: 'eq', args: ['source_url', 'https://example.com/tiramisu'] },
    ])
  })

  it('matches a Facebook group post under any group name through the LIKE pattern', async () => {
    const { client, calls } = makeClient({ public_recipes: { id: 9, slug: 'paella' } })

    const result = await findExistingRecipeForUrl(client, USER, 'https://www.facebook.com/groups/kuchnia/posts/123/')

    expect(result).toMatchObject({ status: 'other', recipeId: 9 })
    expect(calls).toContainEqual({
      table: 'public_recipes',
      method: 'like',
      args: ['source_url', 'https://www.facebook.com/groups/%/posts/123'],
    })
  })

  it('falls back to the user’s pending share, then to a new link', async () => {
    const pending = makeClient({ recipe_shares: { id: 3 } })
    expect(await findExistingRecipeForUrl(pending.client, USER, 'https://example.com/x')).toMatchObject({ status: 'pending' })

    const fresh = makeClient({})
    expect(await findExistingRecipeForUrl(fresh.client, USER, 'https://example.com/x')).toMatchObject({ status: 'new' })
  })
})
