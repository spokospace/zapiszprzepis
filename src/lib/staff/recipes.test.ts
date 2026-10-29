import { describe, it, expect, vi } from 'vitest'
import {
  callAdminData,
  getRecipe,
  listMerges,
  listRecipes,
  mapRecipeRow,
  parseLoserIds,
  parseRecipeFilter,
  parseRecipeId,
  parseRecipesCursor,
  parseRedirectSlug,
  parseTaxonomy,
  RECIPES_PAGE_SIZE,
} from './recipes'

const ROW = {
  recipe_id: '12',
  slug: 'zupa',
  title: 'Zupa',
  category: 'zupy',
  source_type: 'web_blog',
  source_url: 'https://example.invalid/zupa',
  owner_id: '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b',
  owner_username: 'ania',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: null,
  hidden_at: null,
  hidden_reason: null,
  favorite_count: '3',
}

describe('mapRecipeRow', () => {
  it('maps a row, reading bigint strings as numbers', () => {
    expect(mapRecipeRow(ROW)).toMatchObject({ id: 12, slug: 'zupa', favoriteCount: 3, hiddenAt: null, ownerUsername: 'ania' })
  })

  it('keeps the hidden state and its reason', () => {
    expect(mapRecipeRow({ ...ROW, hidden_at: '2026-10-02T10:00:00Z', hidden_reason: 'spam' })).toMatchObject({
      hiddenAt: '2026-10-02T10:00:00Z',
      hiddenReason: 'spam',
    })
  })

  it('rejects a row without an id, a slug or an owner', () => {
    expect(mapRecipeRow({ ...ROW, recipe_id: 'x' })).toBeNull()
    expect(mapRecipeRow({ ...ROW, slug: null })).toBeNull()
    expect(mapRecipeRow({ ...ROW, owner_id: null })).toBeNull()
    expect(mapRecipeRow(null)).toBeNull()
  })
})

describe('parsers', () => {
  it('reads a recipe id only from digits', () => {
    expect(parseRecipeId('42')).toBe(42)
    expect(parseRecipeId(' 42 ')).toBe(42)
    for (const bad of ['0', '-1', '4.2', '1e3', '', 'abc', null, undefined, 42]) expect(parseRecipeId(bad)).toBeNull()
  })

  it('falls back to "all" for an unknown filter', () => {
    expect(parseRecipeFilter('hidden')).toBe('hidden')
    expect(parseRecipeFilter('drop table')).toBe('all')
    expect(parseRecipeFilter(undefined)).toBe('all')
  })

  it('reads a list cursor, or none when it is malformed', () => {
    expect(parseRecipesCursor('2026-10-01T10:00:00Z', '7')).toEqual({ createdAt: '2026-10-01T10:00:00Z', id: 7 })
    expect(parseRecipesCursor('yesterday', '7')).toBeNull()
    expect(parseRecipesCursor('2026-10-01T10:00:00Z', 'x')).toBeNull()
    expect(parseRecipesCursor(undefined, '7')).toBeNull()
  })

  it('takes a redirect as a slug, a path or an address of a recipe, and nothing else', () => {
    expect(parseRedirectSlug('zupa-pomidorowa')).toBe('zupa-pomidorowa')
    expect(parseRedirectSlug('/przepis/zupa-pomidorowa')).toBe('zupa-pomidorowa')
    expect(parseRedirectSlug('https://zapiszprzepis.pl/przepis/zupa-pomidorowa?from=fav')).toBe('zupa-pomidorowa')
    for (const bad of ['', 'Zupa Pomidorowa', '../etc', 'a/b', 'zupa_pomidorowa']) expect(parseRedirectSlug(bad)).toBeNull()
  })

  it('reads duplicate ids: unique, numeric, not the canonical, at most 20', () => {
    expect(parseLoserIds('5, 6 7;8', 1)).toEqual([5, 6, 7, 8])
    expect(parseLoserIds('', 1)).toBeNull()
    expect(parseLoserIds('5, 5', 1)).toBeNull()
    expect(parseLoserIds('1, 2', 1)).toBeNull()
    expect(parseLoserIds('5, x', 1)).toBeNull()
    expect(parseLoserIds(Array.from({ length: 21 }, (_, i) => i + 10).join(','), 1)).toBeNull()
  })
})

describe('parseTaxonomy', () => {
  it('accepts a known category with known tags', () => {
    expect(parseTaxonomy('zupy', ['grill', 'szybkie'])).toEqual({ category: 'zupy', tags: ['grill', 'szybkie'] })
  })

  it('a blank category keeps the current one; a blank tag list clears the tags', () => {
    expect(parseTaxonomy('', [])).toEqual({ category: null, tags: [] })
  })

  it('refuses an unknown category, an unknown tag, a repeated tag turned seven, or too many tags', () => {
    expect(parseTaxonomy('nope', [])).toBeNull()
    expect(parseTaxonomy('zupy', ['not-a-tag'])).toBeNull()
    expect(parseTaxonomy('zupy', ['grill', 'impreza', 'kruche', 'maslane', 'drozdzowe', 'biszkoptowe', 'francuskie'])).toBeNull()
  })

  it('collapses a repeated tag', () => {
    expect(parseTaxonomy('zupy', ['grill', 'grill'])).toEqual({ category: 'zupy', tags: ['grill'] })
  })
})

function clientReturning(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }))
  return { rpc, client: { rpc } as never }
}

describe('listRecipes', () => {
  it('asks for one row more than a page and returns a cursor when there is another page', async () => {
    const rows = Array.from({ length: RECIPES_PAGE_SIZE + 1 }, (_, i) => ({ ...ROW, recipe_id: 100 - i }))
    const { rpc, client } = clientReturning(rows)
    const page = await listRecipes(client, { query: ' zupa ', filter: 'hidden' })
    expect(rpc).toHaveBeenCalledWith('admin_list_recipes', expect.objectContaining({ p_query: 'zupa', p_filter: 'hidden', p_limit: RECIPES_PAGE_SIZE + 1 }))
    expect(page?.recipes).toHaveLength(RECIPES_PAGE_SIZE)
    expect(page?.next).toEqual({ createdAt: ROW.created_at, id: 100 - (RECIPES_PAGE_SIZE - 1) })
  })

  it('has no next page on a short answer, and null on an error', async () => {
    expect((await listRecipes(clientReturning([ROW]).client, {}))?.next).toBeNull()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await listRecipes(clientReturning(null, { message: 'forbidden' }).client, {})).toBeNull()
  })
})

describe('getRecipe / listMerges', () => {
  it('reads one recipe, or null when the function returns nothing', async () => {
    expect((await getRecipe(clientReturning([ROW]).client, 12))?.slug).toBe('zupa')
    expect(await getRecipe(clientReturning([]).client, 12)).toBeNull()
  })

  it('maps merges with their loser ids and slugs', async () => {
    const merges = await listMerges(
      clientReturning([{ merge_id: 'm1', merged_at: '2026-10-02T10:00:00Z', loser_ids: [5, '6'], loser_slugs: ['a', 'b'] }]).client,
      1,
    )
    expect(merges).toEqual([{ mergeId: 'm1', mergedAt: '2026-10-02T10:00:00Z', loserIds: [5, 6], loserSlugs: ['a', 'b'] }])
  })
})

describe('callAdminData', () => {
  it('returns the data of a successful call', async () => {
    expect(await callAdminData(clientReturning('zupa').client, 'admin_hide_recipe', {})).toEqual({ data: 'zupa', error: null })
  })

  it('returns a stable code for one of ours and "unknown" for any other database text', async () => {
    expect(await callAdminData(clientReturning(null, { message: 'canonical_hidden' }).client, 'x', {})).toEqual({ data: null, error: 'canonical_hidden' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await callAdminData(clientReturning(null, { message: 'relation "x" does not exist' }).client, 'x', {})).toEqual({ data: null, error: 'unknown' })
  })

  it('turns a thrown call into "unknown"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = { rpc: vi.fn(async () => { throw new Error('network') }) } as never
    expect(await callAdminData(client, 'x', {})).toEqual({ data: null, error: 'unknown' })
  })
})
