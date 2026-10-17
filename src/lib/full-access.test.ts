import { describe, it, expect, vi } from 'vitest'
import { getFullAccess } from './full-access'

function client(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as any
}

describe('getFullAccess (E01-S11)', () => {
  it('is true when the RPC says so', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    expect(await getFullAccess(client(rpc))).toBe(true)
    expect(rpc).toHaveBeenCalledWith('has_full_access')
  })

  it('is false when the RPC says false', async () => {
    expect(await getFullAccess(client(vi.fn().mockResolvedValue({ data: false, error: null })))).toBe(false)
  })

  it('fails closed on an RPC error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function does not exist' } })
    expect(await getFullAccess(client(rpc))).toBe(false)
  })

  it('fails closed when the call throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getFullAccess(client(vi.fn().mockRejectedValue(new Error('network'))))).toBe(false)
  })
})
