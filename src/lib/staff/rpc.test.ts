import { describe, it, expect, vi } from 'vitest'
import { callAdmin } from './rpc'

const client = (answer: () => unknown) => ({ rpc: vi.fn(async () => answer()) }) as never

describe('callAdmin', () => {
  it('is null when the function worked', async () => {
    expect(await callAdmin(client(() => ({ error: null })), 'admin_block_user', { p_user: 'x' })).toBeNull()
  })

  it('returns the code the function raised', async () => {
    expect(await callAdmin(client(() => ({ error: { message: 'cannot_target_staff' } })), 'admin_block_user', {})).toBe(
      'cannot_target_staff',
    )
  })

  it('hides unknown database text behind unknown, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await callAdmin(client(() => ({ error: { message: 'relation "x" does not exist' } })), 'f', {})).toBe('unknown')
    expect(log).toHaveBeenCalled()
  })

  it('treats a throw as unknown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwing = client(() => {
      throw new Error('network')
    })
    expect(await callAdmin(throwing, 'f', {})).toBe('unknown')
  })

  it('passes the function name and arguments through', async () => {
    const supabase = client(() => ({ error: null }))
    await callAdmin(supabase, 'admin_delete_user', { p_user: 'u' })
    expect((supabase as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('admin_delete_user', { p_user: 'u' })
  })
})
