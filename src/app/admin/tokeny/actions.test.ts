import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))

import { requirePermission } from '@/lib/staff/context'
import { createToken, revokeToken } from './actions'

const TOKEN = `zpm_${'a'.repeat(64)}`

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

describe('token actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('answer 404 to someone without tokens.own', async () => {
    vi.mocked(requirePermission).mockImplementation(async () => {
      throw new Error('NOT_FOUND')
    })
    await expect(createToken(null, form({ label: 'x' }))).rejects.toThrow('NOT_FOUND')
    await expect(revokeToken(form({ id: '1' }))).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith('tokens.own')
  })

  it('returns the secret in the action result only, never in a redirect', async () => {
    const rpc = staffRpc({ data: TOKEN })
    const result = await createToken(null, form({ label: ' laptop ', days: '30' }))
    expect(result).toEqual({ token: TOKEN })
    expect(rpc).toHaveBeenCalledWith('admin_create_token', { p_label: 'laptop', p_days: 30 })
  })

  it('does not call the database for an invalid form', async () => {
    const rpc = staffRpc({ data: TOKEN })
    expect(await createToken(null, form({ label: '', days: '90' }))).toHaveProperty('error')
    expect(await createToken(null, form({ label: 'x', days: '9999' }))).toHaveProperty('error')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shows the Polish text for the ten-token cap and never the database text', async () => {
    staffRpc({ error: { message: 'too_many_tokens' } })
    expect(await createToken(null, form({ label: 'x' }))).toEqual({ error: expect.stringContaining('10 aktywnych') })
    staffRpc({ error: { message: 'duplicate key value violates unique constraint "staff_tokens_token_hash_key"' } })
    const result = await createToken(null, form({ label: 'x' }))
    expect(JSON.stringify(result)).not.toContain('staff_tokens')
  })

  it('revokes by id through the caller\'s own session', async () => {
    const rpc = staffRpc({})
    await expect(revokeToken(form({ id: '12' }))).rejects.toThrow('REDIRECT /admin/tokeny?ok=revoked')
    expect(rpc).toHaveBeenCalledWith('admin_revoke_token', { p_id: 12 })
  })

  it('flashes the error when the function refuses (not the caller\'s token)', async () => {
    staffRpc({ error: { message: 'not_found' } })
    await expect(revokeToken(form({ id: '12' }))).rejects.toThrow('REDIRECT /admin/tokeny?error=not_found')
  })

  it('rejects a malformed id without a call', async () => {
    const rpc = staffRpc({})
    await expect(revokeToken(form({ id: 'abc' }))).rejects.toThrow('error=invalid_input')
    expect(rpc).not.toHaveBeenCalled()
  })
})
