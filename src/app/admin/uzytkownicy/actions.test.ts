import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect() and notFound() end the action by throwing, as Next's do.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))

import { requirePermission } from '@/lib/staff/context'
import { blockUser, deleteUser, unblockUser } from './actions'

const ID = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}

/** A staff session whose rpc answers with `error` (or succeeds). */
function staffWith(error: { message: string } | null = null) {
  const supabase = { rpc: vi.fn(async () => ({ error })) }
  vi.mocked(requirePermission).mockResolvedValue({ supabase, user: { id: 'staff-1' }, permissions: new Set() } as never)
  return supabase
}

async function redirectOf(run: Promise<unknown>) {
  try {
    await run
  } catch (e) {
    return (e as Error).message
  }
  return null
}

describe('block / unblock / delete — the permission gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['blockUser', blockUser, 'users.block'],
    ['unblockUser', unblockUser, 'users.block'],
    ['deleteUser', deleteUser, 'users.delete'],
  ] as const)('%s answers 404 for someone without %s and never reaches the database', async (_n, action, permission) => {
    vi.mocked(requirePermission).mockImplementation(async () => {
      throw new Error('NOT_FOUND')
    })
    await expect(action(form({ id: ID, confirm: 'USUŃ' }))).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith(permission)
  })
})

describe('blockUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls admin_block_user with the trimmed reason and reports success', async () => {
    const supabase = staffWith()
    const to = await redirectOf(blockUser(form({ id: ID, reason: '  spam  ' })))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_block_user', { p_user: ID, p_reason: 'spam' })
    expect(to).toBe(`REDIRECT /admin/uzytkownicy/${ID}?ok=blocked`)
  })

  it('refuses an id that is not a uuid before calling the database', async () => {
    const supabase = staffWith()
    const to = await redirectOf(blockUser(form({ id: 'abc' })))
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(to).toBe('REDIRECT /admin/uzytkownicy?error=invalid_input')
  })

  it('shows the database refusal for a staff target as its own message', async () => {
    staffWith({ message: 'cannot_target_staff' })
    const to = await redirectOf(blockUser(form({ id: ID })))
    expect(to).toBe(`REDIRECT /admin/uzytkownicy/${ID}?error=cannot_target_staff`)
  })
})

describe('unblockUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls admin_unblock_user', async () => {
    const supabase = staffWith()
    const to = await redirectOf(unblockUser(form({ id: ID })))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_unblock_user', { p_user: ID })
    expect(to).toBe(`REDIRECT /admin/uzytkownicy/${ID}?ok=unblocked`)
  })
})

describe('deleteUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing without the typed confirmation', async () => {
    const supabase = staffWith()
    const to = await redirectOf(deleteUser(form({ id: ID, confirm: 'tak' })))
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(to).toBe(`REDIRECT /admin/uzytkownicy/${ID}?error=confirm_mismatch`)
  })

  it('accepts the confirmation in any case, deletes through the wrapper and returns to the list', async () => {
    const supabase = staffWith()
    const to = await redirectOf(deleteUser(form({ id: ID, confirm: ' usuń ' })))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_user', { p_user: ID })
    expect(to).toBe('REDIRECT /admin/uzytkownicy?ok=deleted')
  })

  it('stays on the account when the database refuses', async () => {
    staffWith({ message: 'cannot_target_self' })
    const to = await redirectOf(deleteUser(form({ id: ID, confirm: 'USUŃ' })))
    expect(to).toBe(`REDIRECT /admin/uzytkownicy/${ID}?error=cannot_target_self`)
  })
})
