import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))

import { requirePermission } from '@/lib/staff/context'
import { createAccessCode, setFullAccess } from './actions'

const ID = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}

function staffRpc(answer: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn(async () => ({ data: null, error: null, ...answer }))
  vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc }, user: { id: 's' }, permissions: new Set() } as never)
  return rpc
}

describe('access actions — the permission gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a moderator (no access.manage) gets 404 on creating a code and on toggling access', async () => {
    vi.mocked(requirePermission).mockImplementation(async () => {
      throw new Error('NOT_FOUND')
    })
    await expect(createAccessCode(null, form({}))).rejects.toThrow('NOT_FOUND')
    await expect(setFullAccess(form({ id: ID, on: 'true' }))).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith('access.manage')
  })
})

describe('createAccessCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the generated code in the action result, never in a redirect', async () => {
    const rpc = staffRpc({ data: 'ABCD-EFGH-JKLM-NPQR' })
    const result = await createAccessCode(null, form({ note: 'rodzina', maxUses: '3' }))
    expect(result).toEqual({ code: 'ABCD-EFGH-JKLM-NPQR' })
    expect(rpc).toHaveBeenCalledWith('admin_create_access_code', { p_note: 'rodzina', p_max_uses: 3, p_expires_at: null })
  })

  it('does not call the database for an invalid form', async () => {
    const rpc = staffRpc({ data: 'x' })
    const result = await createAccessCode(null, form({ maxUses: '0' }))
    expect(result).toHaveProperty('error')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shows our message, not the database text, when the call fails', async () => {
    staffRpc({ error: { message: 'new row violates check constraint "access_codes_max_uses_check"' } })
    const result = await createAccessCode(null, form({}))
    expect(result).toEqual({ error: expect.stringMatching(/Nie udało się/) })
  })

  it('treats an empty answer as a failure rather than showing a blank code', async () => {
    staffRpc({ data: '' })
    expect(await createAccessCode(null, form({}))).toHaveProperty('error')
  })
})

describe('setFullAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grants through the wrapper and reports it on the account page', async () => {
    const rpc = staffRpc({})
    await expect(setFullAccess(form({ id: ID, on: 'true' }))).rejects.toThrow(
      `REDIRECT /admin/uzytkownicy/${ID}?ok=access_granted`,
    )
    expect(rpc).toHaveBeenCalledWith('admin_set_full_access', { p_user: ID, p_on: true })
  })

  it('revokes when on is anything but true', async () => {
    const rpc = staffRpc({})
    await expect(setFullAccess(form({ id: ID, on: 'false' }))).rejects.toThrow('ok=access_revoked')
    expect(rpc).toHaveBeenCalledWith('admin_set_full_access', { p_user: ID, p_on: false })
  })

  it('refuses a malformed id before the database', async () => {
    const rpc = staffRpc({})
    await expect(setFullAccess(form({ id: 'nope', on: 'true' }))).rejects.toThrow('error=invalid_input')
    expect(rpc).not.toHaveBeenCalled()
  })
})
