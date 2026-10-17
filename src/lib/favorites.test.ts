import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyFavoriteIntent, getFavoriteIds, parseRecipeId, withFavoriteIntent } from './favorites'

describe('parseRecipeId', () => {
  it('accepts positive integers, as numbers or numeric strings', () => {
    expect(parseRecipeId(42)).toBe(42)
    expect(parseRecipeId('42')).toBe(42)
    expect(parseRecipeId(' 7 ')).toBe(7)
  })

  it('rejects everything else', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, '', '  ', 'abc', '1e3x', null, undefined, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseRecipeId(bad)).toBeNull()
    }
  })
})

describe('withFavoriteIntent', () => {
  it('appends the intent to next, keeping its own query', () => {
    expect(withFavoriteIntent('/przepisy/ciasta?tag=x', '12')).toBe('/przepisy/ciasta?tag=x&add_fav=12')
    expect(withFavoriteIntent('/przepis/tiramisu', '12')).toBe('/przepis/tiramisu?add_fav=12')
  })

  it('uses / when next is missing', () => {
    expect(withFavoriteIntent(undefined, '12')).toBe('/?add_fav=12')
    expect(withFavoriteIntent('  ', '12')).toBe('/?add_fav=12')
  })

  it('leaves next alone for an invalid fav', () => {
    for (const bad of [undefined, '', '0', '-3', 'abc', '1.5']) {
      expect(withFavoriteIntent('/x', bad)).toBe('/x')
    }
    expect(withFavoriteIntent(undefined, 'abc')).toBeUndefined()
  })

  it('leaves a next that points elsewhere for safeNext to refuse', () => {
    expect(withFavoriteIntent('https://evil.example/x', '12')).toBe('https://evil.example/x')
    expect(withFavoriteIntent('//evil.example', '12')).toBe('//evil.example')
  })
})

function fakeInsert(result: { error: { code?: string; message: string } | null } | Error) {
  const insert = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)))
  const from = vi.fn(() => ({ insert }))
  return { client: { from } as unknown as SupabaseClient, from, insert }
}

describe('applyFavoriteIntent', () => {
  it('adds the favorite and swaps the intent for the toast param', async () => {
    const { client, from, insert } = fakeInsert({ error: null })
    await expect(applyFavoriteIntent(client, 'u1', '/przepisy/ciasta?tag=x&add_fav=12')).resolves.toBe(
      '/przepisy/ciasta?tag=x&fav_added=12',
    )
    expect(from).toHaveBeenCalledWith('favorites')
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', recipe_id: 12 })
  })

  it('treats an existing favorite as added', async () => {
    const { client } = fakeInsert({ error: { code: '23505', message: 'duplicate' } })
    await expect(applyFavoriteIntent(client, 'u1', '/?add_fav=12')).resolves.toBe('/?fav_added=12')
  })

  it('drops the intent on any other error, never throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fk = fakeInsert({ error: { code: '23503', message: 'fk' } })
    await expect(applyFavoriteIntent(fk.client, 'u1', '/x?add_fav=12')).resolves.toBe('/x')
    const thrown = fakeInsert(new Error('network'))
    await expect(applyFavoriteIntent(thrown.client, 'u1', '/x?add_fav=12')).resolves.toBe('/x')
    spy.mockRestore()
  })

  it('does nothing without a valid intent (including the retired ?fav=1)', async () => {
    const { client, from } = fakeInsert({ error: null })
    await expect(applyFavoriteIntent(client, 'u1', '/przepis/x?fav=1')).resolves.toBe('/przepis/x?fav=1')
    await expect(applyFavoriteIntent(client, 'u1', '/x?add_fav=abc')).resolves.toBe('/x?add_fav=abc')
    await expect(applyFavoriteIntent(client, 'u1', '/')).resolves.toBe('/')
    expect(from).not.toHaveBeenCalled()
  })
})

function fakeLookup(result: { data: unknown; error: unknown }) {
  const inFn = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ in: inFn }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from } as unknown as SupabaseClient, from, eq, inFn }
}

describe('getFavoriteIds', () => {
  it('returns the favorited subset in one query scoped to the user', async () => {
    const { client, eq, inFn } = fakeLookup({ data: [{ recipe_id: 2 }, { recipe_id: 5 }], error: null })
    await expect(getFavoriteIds(client, 'u1', [1, 2, 5])).resolves.toEqual(new Set([2, 5]))
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(inFn).toHaveBeenCalledWith('recipe_id', [1, 2, 5])
  })

  it('skips the query for no cards', async () => {
    const { client, from } = fakeLookup({ data: [], error: null })
    await expect(getFavoriteIds(client, 'u1', [])).resolves.toEqual(new Set())
    expect(from).not.toHaveBeenCalled()
  })

  it('is empty on error, so hearts render off', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeLookup({ data: null, error: { code: 'x' } })
    await expect(getFavoriteIds(client, 'u1', [1])).resolves.toEqual(new Set())
    spy.mockRestore()
  })
})
