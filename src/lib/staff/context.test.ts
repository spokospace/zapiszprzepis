import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
// notFound() ends the render by throwing, as Next's does.
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))

import { requireUser } from '@/lib/supabase/server'
import { getStaff, requirePermission } from './context'

function signInWith(rpc: () => unknown) {
  const supabase = { rpc: vi.fn(async () => rpc()) }
  vi.mocked(requireUser).mockResolvedValue({ supabase, user: { id: 'u1' } } as never)
  return supabase
}

describe('getStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the permissions the database reports', async () => {
    const supabase = signInWith(() => ({ data: ['users.read', 'imports.read'], error: null }))
    const staff = await getStaff()
    expect(supabase.rpc).toHaveBeenCalledWith('my_permissions')
    expect([...staff!.permissions].sort()).toEqual(['imports.read', 'users.read'])
  })

  it('is null for a user with no role', async () => {
    signInWith(() => ({ data: [], error: null }))
    expect(await getStaff()).toBeNull()
  })

  it('fails closed when the RPC errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    signInWith(() => ({ data: null, error: { message: 'boom' } }))
    expect(await getStaff()).toBeNull()
  })

  it('fails closed when the RPC throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    signInWith(() => {
      throw new Error('network')
    })
    expect(await getStaff()).toBeNull()
  })
})

describe('requirePermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the staff member who holds the permission', async () => {
    signInWith(() => ({ data: ['audit.read'], error: null }))
    const staff = await requirePermission('audit.read')
    expect(staff.user.id).toBe('u1')
  })

  it('answers 404 for staff without that permission (a moderator on the audit log)', async () => {
    signInWith(() => ({ data: ['users.read'], error: null }))
    await expect(requirePermission('audit.read')).rejects.toThrow('NOT_FOUND')
  })

  it('answers 404 for a user who is not staff', async () => {
    signInWith(() => ({ data: [], error: null }))
    await expect(requirePermission('users.read')).rejects.toThrow('NOT_FOUND')
  })
})
