import { describe, it, expect, vi } from 'vitest'
import { parseSearchParams, recipeTime, searchRecipes, searchResultsLabel, webSearchUrl } from './search'

function client(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as any
}

describe('parseSearchParams (E01-S05)', () => {
  it('trims the query and defaults to everything, page 1', () => {
    expect(parseSearchParams({ q: '  sernik ' }, true)).toEqual({ q: 'sernik', scope: 'wszystkie', page: 1 })
    expect(parseSearchParams({}, false)).toEqual({ q: '', scope: 'wszystkie', page: 1 })
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

describe('searchResultsLabel', () => {
  it('declines "przepis" for the count', () => {
    expect(searchResultsLabel(1, 'zupa')).toBe('1 przepis dla „zupa”')
    expect(searchResultsLabel(2, 'zupa')).toBe('2 przepisy dla „zupa”')
    expect(searchResultsLabel(5, 'zupa')).toBe('5 przepisów dla „zupa”')
    expect(searchResultsLabel(12, 'zupa')).toBe('12 przepisów dla „zupa”')
    expect(searchResultsLabel(22, 'zupa')).toBe('22 przepisy dla „zupa”')
  })
})

describe('webSearchUrl', () => {
  it('searches the web for the recipe, encoded', () => {
    expect(webSearchUrl('ciasto & kawa')).toBe('https://www.google.com/search?q=przepis%20ciasto%20%26%20kawa')
  })
})

describe('recipeTime', () => {
  it('prefers the total, else prep + cook, else nothing', () => {
    expect(recipeTime({ total_time_minutes: 45, prep_time_minutes: 10, cook_time_minutes: 20 })).toBe(45)
    expect(recipeTime({ total_time_minutes: null, prep_time_minutes: 10, cook_time_minutes: 20 })).toBe(30)
    expect(recipeTime({ total_time_minutes: null, prep_time_minutes: null, cook_time_minutes: null })).toBeNull()
  })
})

describe('searchRecipes', () => {
  it('does not query for an empty search', async () => {
    const rpc = vi.fn()
    expect(await searchRecipes(client(rpc), { q: '', scope: 'wszystkie', page: 1 })).toEqual({ rows: [], total: 0 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps the scope and asks for page × 14 rows', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    await searchRecipes(client(rpc), { q: 'zupa', scope: 'ulubione', page: 2 })
    expect(rpc).toHaveBeenCalledWith('search_recipes', { p_query: 'zupa', p_scope: 'fav', p_limit: 28 })
    await searchRecipes(client(rpc), { q: 'zupa', scope: 'moje', page: 1 })
    expect(rpc).toHaveBeenLastCalledWith('search_recipes', { p_query: 'zupa', p_scope: 'mine', p_limit: 14 })
  })

  it('reads the total from the window count', async () => {
    const rows = [
      { id: 1, slug: 'a', total_count: '30' },
      { id: 2, slug: 'b', total_count: '30' },
    ]
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null })
    const out = await searchRecipes(client(rpc), { q: 'zupa', scope: 'wszystkie', page: 1 })
    expect(out).toMatchObject({ total: 30 })
    expect('rows' in out && out.rows.map((r) => r.slug)).toEqual(['a', 'b'])
  })

  it('reports an RPC error instead of an empty result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    expect(await searchRecipes(client(rpc), { q: 'zupa', scope: 'wszystkie', page: 1 })).toEqual({
      error: 'function does not exist',
    })
  })
})
