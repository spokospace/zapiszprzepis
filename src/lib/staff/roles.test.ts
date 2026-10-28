import { describe, it, expect, vi } from 'vitest'
import { listStaff, mapMemberRow, mapRoleRow, ROLE_NAME_RE } from './roles'

const ID = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

describe('mapMemberRow / mapRoleRow', () => {
  it('maps a member with several roles', () => {
    expect(
      mapMemberRow({ user_id: ID, username: 'szymon', display_name: 'Szymon', roles: ['admin', 'moderator'], granted_at: '2026-10-28T10:00:00Z' }),
    ).toEqual({ userId: ID, username: 'szymon', displayName: 'Szymon', roles: ['admin', 'moderator'], grantedAt: '2026-10-28T10:00:00Z' })
  })

  it('rejects a member without a uuid', () => {
    expect(mapMemberRow({ user_id: 'x', roles: [] })).toBeNull()
    expect(mapMemberRow(null)).toBeNull()
  })

  it('maps a role with its permissions', () => {
    expect(mapRoleRow({ name: 'moderator', description: null, permissions: ['users.read'] })).toEqual({
      name: 'moderator',
      description: null,
      permissions: ['users.read'],
    })
    expect(mapRoleRow({ description: 'x' })).toBeNull()
  })
})

describe('listStaff', () => {
  it('is null when either call is refused (a moderator opening the roles screen)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = {
      rpc: vi.fn(async (fn: string) =>
        fn === 'admin_list_staff' ? { data: null, error: { message: 'forbidden' } } : { data: [], error: null },
      ),
    } as never
    expect(await listStaff(supabase)).toBeNull()
  })

  it('returns both lists', async () => {
    const supabase = {
      rpc: vi.fn(async (fn: string) => ({
        data: fn === 'admin_list_staff' ? [{ user_id: ID, roles: ['admin'] }] : [{ name: 'admin', permissions: [] }],
        error: null,
      })),
    } as never
    const result = await listStaff(supabase)
    expect(result!.members).toHaveLength(1)
    expect(result!.roles[0].name).toBe('admin')
  })
})

describe('ROLE_NAME_RE', () => {
  it('matches the database check on role names', () => {
    expect(ROLE_NAME_RE.test('moderator')).toBe(true)
    expect(ROLE_NAME_RE.test('Admin')).toBe(false)
    expect(ROLE_NAME_RE.test('a')).toBe(false)
    expect(ROLE_NAME_RE.test("x'; drop table")).toBe(false)
  })
})
