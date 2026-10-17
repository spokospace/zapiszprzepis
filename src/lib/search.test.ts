import { describe, it, expect, vi } from 'vitest'
import { categoryFacets, parseSearchParams, searchRecipes, webSearchUrl } from './search'

function client(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as any
}

describe('parseSearchParams (E01-S05)', () => {
  it('trims the query and defaults to everything, page 1', () => {
    expect(parseSearchParams({ q: '  sernik ' }, true)).toEqual({ q: 'sernik', scope: 'wszystkie', page: 1, category: null })
    expect(parseSearchParams({}, false)).toEqual({ q: '', scope: 'wszystkie', page: 1, category: null })
  })

  it('lets a signed-in user narrow the scope', () => {
    expect(parseSearchParams({ q: 'x', zakres: 'moje' }, true).scope).toBe('moje')
    expect(parseSearchParams({ q: 'x', zakres: 'ulubione' }, true).scope).toBe('ulubione')
  })

  it('always searches everything for a guest, even from a shared link', () => {
    expect(parseSearchParams({ q: 'x', zakres: 'moje' }, false).scope).toBe('wszystkie')
    expect(parseSearchParams({ q: 'x', zakres: 'ulubione' }, false).scope).toBe('wszystkie')
  })

  it('falls back to everything on an unknown scope', () => {
    expect(parseSearchParams({ q: 'x', zakres: 'wszystko' }, true).scope).toBe('wszystkie')
  })

  it('clamps the page to 1…10', () => {
    expect(parseSearchParams({ strona: '3' }, false).page).toBe(3)
    expect(parseSearchParams({ strona: '0' }, false).page).toBe(1)
    expect(parseSearchParams({ strona: '999' }, false).page).toBe(10)
    expect(parseSearchParams({ strona: 'abc' }, false).page).toBe(1)
  })

  it('takes the first of repeated params and caps a long query', () => {
    expect(parseSearchParams({ q: ['a', 'b'] }, false).q).toBe('a')
    expect(parseSearchParams({ q: 'x'.repeat(300) }, false).q).toHaveLength(100)
  })
})

describe('parseSearchParams: kategoria (E01-S22)', () => {
  it('keeps a known category, drops anything else', () => {
    expect(parseSearchParams({ q: 'x', kategoria: 'zupy' }, false).category).toBe('zupy')
    expect(parseSearchParams({ q: 'x', kategoria: 'Zupy' }, false).category).toBeNull()
    expect(parseSearchParams({ q: 'x', kategoria: 'kolacje' }, false).category).toBeNull()
  })
})

describe('categoryFacets', () => {
  it('counts the categories, most first, ties in category order', () => {
    const rows = [{ category: 'desery' }, { category: 'zupy' }, { category: 'desery' }, { category: 'obiady' }]
    expect(categoryFacets(rows)).toEqual([
      { value: 'desery', label: 'Desery', count: 2 },
      { value: 'obiady', label: 'Obiady', count: 1 },
      { value: 'zupy', label: 'Zupy', count: 1 },
    ])
  })
})

describe('webSearchUrl', () => {
  it('searches the web for the recipe, encoded', () => {
    expect(webSearchUrl('ciasto & kawa')).toBe('https://www.google.com/search?q=przepis%20ciasto%20%26%20kawa')
  })
})

describe('searchRecipes', () => {
  it('does not query for an empty search', async () => {
    const rpc = vi.fn()
    expect(await searchRecipes(client(rpc), { q: '', scope: 'wszystkie', page: 1, category: null })).toEqual({
      rows: [],
      total: 0,
      categories: [],
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps the scope and reads every reachable row (140)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    await searchRecipes(client(rpc), { q: 'zupa', scope: 'ulubione', page: 2, category: null })
    expect(rpc).toHaveBeenCalledWith('search_recipes', { p_query: 'zupa', p_scope: 'fav', p_limit: 140 })
    await searchRecipes(client(rpc), { q: 'zupa', scope: 'moje', page: 1, category: null })
    expect(rpc).toHaveBeenLastCalledWith('search_recipes', { p_query: 'zupa', p_scope: 'mine', p_limit: 140 })
  })

  it('returns page × 14 rows', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i, slug: `r${i}`, category: 'zupy', total_count: 30 }))
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null })
    const out = await searchRecipes(client(rpc), { q: 'zupa', scope: 'wszystkie', page: 2, category: null })
    expect('rows' in out && out.rows).toHaveLength(28)
    expect(out).toMatchObject({ total: 30, categories: [{ value: 'zupy', count: 30 }] })
  })

  it('narrows to the category; the total and paging follow, the facets do not', async () => {
    const rows = [
      { id: 1, slug: 'a', category: 'zupy', total_count: 3 },
      { id: 2, slug: 'b', category: 'obiady', total_count: 3 },
      { id: 3, slug: 'c', category: 'zupy', total_count: 3 },
    ]
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null })
    const out = await searchRecipes(client(rpc), { q: 'zupa', scope: 'wszystkie', page: 1, category: 'zupy' })
    expect('rows' in out && out.rows.map((r) => r.slug)).toEqual(['a', 'c'])
    expect(out).toMatchObject({ total: 2 })
    expect('categories' in out && out.categories.map((c) => c.value)).toEqual(['zupy', 'obiady'])
  })

  it('reads the total from the window count', async () => {
    const rows = [
      { id: 1, slug: 'a', total_count: '30' },
      { id: 2, slug: 'b', total_count: '30' },
    ]
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null })
    const out = await searchRecipes(client(rpc), { q: 'zupa', scope: 'wszystkie', page: 1, category: null })
    expect(out).toMatchObject({ total: 30 })
    expect('rows' in out && out.rows.map((r) => r.slug)).toEqual(['a', 'b'])
  })

  it('reports an RPC error instead of an empty result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    expect(await searchRecipes(client(rpc), { q: 'zupa', scope: 'wszystkie', page: 1, category: null })).toEqual({
      error: 'function does not exist',
    })
  })
})
