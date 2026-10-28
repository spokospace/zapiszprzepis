import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))

import { requirePermission } from '@/lib/staff/context'
import { setRole } from './actions'

const ID = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}

function staffRpc(error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data: null, error }))
  vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc }, user: { id: 's' }, permissions: new Set() } as never)
  return rpc
}

describe('setRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a moderator (no roles.manage) gets 404', async () => {
    vi.mocked(requirePermission).mockImplementation(async () => {
      throw new Error('NOT_FOUND')
    })
    await expect(setRole(form({ id: ID, role: 'admin', on: 'true' }))).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith('roles.manage')
  })

  it('grants through the wrapper and returns to the roles screen', async () => {
    const rpc = staffRpc()
    await expect(setRole(form({ id: ID, role: 'moderator', on: 'true' }))).rejects.toThrow('REDIRECT /admin/role?ok=role_granted')
    expect(rpc).toHaveBeenCalledWith('admin_set_role', { p_user: ID, p_role: 'moderator', p_on: true })
  })

  it('returns to the account page when the form came from there', async () => {
    staffRpc()
    await expect(setRole(form({ id: ID, role: 'moderator', on: 'false', from: 'account' }))).rejects.toThrow(
      `REDIRECT /admin/uzytkownicy/${ID}?ok=role_revoked`,
    )
  })

  it('shows the last-admin refusal from the database', async () => {
    staffRpc({ message: 'last_admin' })
    await expect(setRole(form({ id: ID, role: 'admin', on: 'false' }))).rejects.toThrow('error=last_admin')
  })

  it('shows the own-role refusal from the database', async () => {
    staffRpc({ message: 'cannot_change_own_role' })
    await expect(setRole(form({ id: ID, role: 'admin', on: 'false' }))).rejects.toThrow('error=cannot_change_own_role')
  })

  it('does not call the database for a malformed id or role name', async () => {
    const rpc = staffRpc()
    await expect(setRole(form({ id: 'x', role: 'admin', on: 'true' }))).rejects.toThrow('error=invalid_input')
    await expect(setRole(form({ id: ID, role: "x'; --", on: 'true' }))).rejects.toThrow('error=invalid_input')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('never redirects to a path taken from the form', async () => {
    staffRpc()
    await expect(setRole(form({ id: ID, role: 'moderator', on: 'true', from: 'https://evil.example' }))).rejects.toThrow(
      'REDIRECT /admin/role?ok=role_granted',
    )
  })
})
