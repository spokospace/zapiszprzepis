import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { genderSaveRedirect, parseGender, postLoginPath, welcomePath } from './first-login'

describe('welcomePath', () => {
  it('puts the error before next', () => {
    expect(welcomePath('/', 'invalid')).toBe('/witaj?error=invalid&next=%2F')
  })
})

describe('parseGender', () => {
  it('accepts only female/male', () => {
    expect(parseGender('female')).toBe('female')
    expect(parseGender('male')).toBe('male')
    expect(parseGender('other')).toBeNull()
    expect(parseGender('FEMALE')).toBeNull()
    expect(parseGender(null)).toBeNull()
  })
})

describe('genderSaveRedirect', () => {
  it('continues to next on ok and already_set (first write wins)', () => {
    expect(genderSaveRedirect('ok', '/recipes')).toBe('/recipes')
    expect(genderSaveRedirect('already_set', '/recipes')).toBe('/recipes')
  })

  it('returns to /witaj with an error otherwise', () => {
    expect(genderSaveRedirect('invalid', '/')).toBe('/witaj?error=invalid&next=%2F')
    expect(genderSaveRedirect(undefined, '/')).toBe('/witaj?error=unknown&next=%2F')
  })
})

function fakeSupabase(user: { id: string } | null, result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const insert = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn(() => ({ select, insert }))
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as unknown as SupabaseClient
  return { client, from, eq, insert }
}

// #376: gender is optional, so no login is detoured to /witaj.
describe('postLoginPath', () => {
  it('goes to next without reading the gender', async () => {
    const { client, from } = fakeSupabase({ id: 'u1' }, { data: null, error: null })
    await expect(postLoginPath(client, '/recipes')).resolves.toBe('/recipes')
    expect(from).not.toHaveBeenCalledWith('profiles_private')
  })

  it('applies a favorite intent (E01-S06)', async () => {
    const { client, insert } = fakeSupabase({ id: 'u1' }, { data: null, error: null })
    await expect(postLoginPath(client, '/przepisy/ciasta?add_fav=12')).resolves.toBe('/przepisy/ciasta?fav_added=12')
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', recipe_id: 12 })
  })

  it('goes to next without a session', async () => {
    const { client, from } = fakeSupabase(null, { data: null, error: null })
    await expect(postLoginPath(client, '/recipes')).resolves.toBe('/recipes')
    expect(from).not.toHaveBeenCalled()
  })
})
