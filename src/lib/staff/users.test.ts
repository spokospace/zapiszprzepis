import { describe, it, expect, vi } from 'vitest'
import { getUser, listUsers, mapUserRow, parseUsersCursor, USERS_PAGE_SIZE } from './users'

const ID = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

const row = (over: Record<string, unknown> = {}) => ({
  user_id: ID,
  username: 'ola',
  display_name: 'Ola',
  email: null,
  created_at: '2026-10-01T10:00:00Z',
  last_sign_in_at: null,
  banned_until: null,
  provider: 'google',
  recipe_count: '3',
  favorite_count: 4,
  full_access: true,
  roles: [],
  ...over,
})

describe('mapUserRow', () => {
  it('maps a row and coerces bigint counts that arrive as strings', () => {
    expect(mapUserRow(row())).toMatchObject({ id: ID, recipeCount: 3, favoriteCount: 4, provider: 'google', blocked: false })
  })

  it('keeps the e-mail null when the database withheld it', () => {
    expect(mapUserRow(row())!.email).toBeNull()
  })

  it('is blocked only while banned_until lies in the future', () => {
    const now = new Date('2026-10-28T12:00:00Z')
    expect(mapUserRow(row({ banned_until: '2126-10-28T12:00:00Z' }), now)!.blocked).toBe(true)
    expect(mapUserRow(row({ banned_until: '2026-10-01T00:00:00Z' }), now)!.blocked).toBe(false)
  })

  it('rejects a malformed row instead of rendering garbage', () => {
    expect(mapUserRow(null)).toBeNull()
    expect(mapUserRow(row({ user_id: 'not-a-uuid' }))).toBeNull()
    expect(mapUserRow(row({ recipe_count: 'many' }))).toBeNull()
    expect(mapUserRow(row({ created_at: undefined }))).toBeNull()
  })
})

function client(result: { data?: unknown; error?: { message: string } | null }) {
  return { rpc: vi.fn(async () => ({ data: null, error: null, ...result })) } as never
}

describe('listUsers', () => {
  it('asks for one row more than a page and returns a cursor when there is another page', async () => {
    const rows = Array.from({ length: USERS_PAGE_SIZE + 1 }, (_, i) =>
      row({ user_id: `3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f${String(i).padStart(4, '0')}` }),
    )
    const supabase = client({ data: rows })
    const page = await listUsers(supabase, { query: ' ola ' })
    expect(page!.users).toHaveLength(USERS_PAGE_SIZE)
    expect(page!.next).toEqual({ createdAt: '2026-10-01T10:00:00Z', id: page!.users.at(-1)!.id })
    expect((supabase as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('admin_list_users', {
      p_query: 'ola',
      p_limit: USERS_PAGE_SIZE + 1,
      p_after_created: null,
      p_after_id: null,
    })
  })

  it('has no cursor on the last page', async () => {
    const page = await listUsers(client({ data: [row()] }), {})
    expect(page!.next).toBeNull()
  })

  it('is null when the database refuses (a moderator without the permission, an outage)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await listUsers(client({ error: { message: 'forbidden' } }), {})).toBeNull()
  })
})

describe('getUser', () => {
  it('does not call the database for an id that is not a uuid', async () => {
    const supabase = client({ data: [] })
    expect(await getUser(supabase, "1' or '1'='1")).toBeNull()
    expect((supabase as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled()
  })

  it('is null when no row comes back', async () => {
    expect(await getUser(client({ data: [] }), ID)).toBeNull()
  })
})

describe('parseUsersCursor', () => {
  it('accepts a timestamp and a uuid', () => {
    expect(parseUsersCursor('2026-10-01T10:00:00Z', ID)).toEqual({ createdAt: '2026-10-01T10:00:00Z', id: ID })
  })

  it('treats anything malformed or partial as the first page', () => {
    expect(parseUsersCursor(undefined, ID)).toBeNull()
    expect(parseUsersCursor('yesterday', ID)).toBeNull()
    expect(parseUsersCursor('2026-10-01T10:00:00Z', 'x')).toBeNull()
  })
})
