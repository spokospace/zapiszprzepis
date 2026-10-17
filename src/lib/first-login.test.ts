import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { firstLoginTarget, genderSaveRedirect, parseGender, postLoginPath, welcomePath } from './first-login'

describe('firstLoginTarget', () => {
  it('sends a user without gender to /witaj, keeping next', () => {
    expect(firstLoginTarget(null, '/przepis/sernik')).toBe('/witaj?next=%2Fprzepis%2Fsernik')
  })

  it('passes a user with gender straight through', () => {
    expect(firstLoginTarget('female', '/recipes')).toBe('/recipes')
  })

  it('never wraps /witaj in itself', () => {
    expect(firstLoginTarget(null, '/witaj?next=%2F')).toBe('/witaj?next=%2F')
    expect(firstLoginTarget(null, '/witaj')).toBe('/witaj')
  })
})

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

describe('postLoginPath', () => {
  it('reads the signed-in user’s own row', async () => {
    const { client, from, eq } = fakeSupabase({ id: 'u1' }, { data: null, error: null })
    await expect(postLoginPath(client, '/')).resolves.toBe('/witaj?next=%2F')
    expect(from).toHaveBeenCalledWith('profiles_private')
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('goes to next when gender is chosen', async () => {
    const { client } = fakeSupabase({ id: 'u1' }, { data: { gender: 'male' }, error: null })
    await expect(postLoginPath(client, '/recipes')).resolves.toBe('/recipes')
  })

  it('fails open on a read error (e.g. table not migrated yet)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeSupabase({ id: 'u1' }, { data: null, error: { code: '42P01' } })
    await expect(postLoginPath(client, '/recipes')).resolves.toBe('/recipes')
    spy.mockRestore()
  })

  it('applies a favorite intent before the gender detour (E01-S06)', async () => {
    const { client, insert } = fakeSupabase({ id: 'u1' }, { data: null, error: null })
    await expect(postLoginPath(client, '/przepisy/ciasta?add_fav=12')).resolves.toBe(
      '/witaj?next=%2Fprzepisy%2Fciasta%3Ffav_added%3D12',
    )
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', recipe_id: 12 })
  })

  it('applies a favorite intent for a returning user', async () => {
    const { client } = fakeSupabase({ id: 'u1' }, { data: { gender: 'female' }, error: null })
    await expect(postLoginPath(client, '/?add_fav=12')).resolves.toBe('/?fav_added=12')
  })

  it('goes to next without a session', async () => {
    const { client, from } = fakeSupabase(null, { data: null, error: null })
    await expect(postLoginPath(client, '/recipes')).resolves.toBe('/recipes')
    expect(from).not.toHaveBeenCalled()
  })
})
