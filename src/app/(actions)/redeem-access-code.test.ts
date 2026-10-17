import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))

import { requireUser } from '@/lib/supabase/server'
import { redeemAccessCode } from './redeem-access-code'

const rpc = vi.fn()
const IDLE = { status: 'idle' as const }

function form(code: string) {
  const data = new FormData()
  data.set('code', code)
  return data
}

describe('redeemAccessCode (E01-S11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ supabase: { rpc }, user: { id: 'u1' } } as any)
  })

  it.each([
    ['ok', 'ok'],
    ['already', 'ok'],
    ['invalid', 'invalid'],
    ['rate_limited', 'rate_limited'],
    ['something-new', 'error'],
  ])('maps the RPC answer %s to %s', async (answer, status) => {
    rpc.mockResolvedValue({ data: answer, error: null })
    expect(await redeemAccessCode(IDLE, form('ABCD-1234'))).toEqual({ status })
  })

  it('sends the trimmed code to the RPC (normalization itself is in SQL)', async () => {
    rpc.mockResolvedValue({ data: 'ok', error: null })
    await redeemAccessCode(IDLE, form('  AbCd 1234  '))
    expect(rpc).toHaveBeenCalledWith('redeem_access_code', { p_code: 'AbCd 1234' })
  })

  it('rejects an empty code without calling the RPC', async () => {
    expect(await redeemAccessCode(IDLE, form('   '))).toEqual({ status: 'invalid' })
    expect(rpc).not.toHaveBeenCalled()
    expect(requireUser).not.toHaveBeenCalled()
  })

  it('reports a server error when the RPC fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await redeemAccessCode(IDLE, form('ABCD-1234'))).toEqual({ status: 'error' })
  })
})
