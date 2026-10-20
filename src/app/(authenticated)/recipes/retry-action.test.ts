import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect() ends the action by throwing, as Next's does.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/lib/full-access', () => ({ getFullAccess: vi.fn() }))

import { requireUser } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { getFullAccess } from '@/lib/full-access'
import { retryShare } from './retry-action'

const USER = { id: 'user-1' }

/**
 * A Supabase stub covering both chains retryShare uses:
 *   SELECT: from().select().eq().single()  → resolves `selectRow`
 *   UPDATE: from().update().eq().eq().select() → resolves `updateResult`
 * `from` is returned so tests can assert it was (not) called.
 */
function supabaseStub(
  selectRow: unknown,
  updateResult: { data?: unknown; error?: unknown } = { data: [{ id: 1 }], error: null },
) {
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: selectRow, error: null }),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn().mockResolvedValue(updateResult),
        })),
      })),
    })),
  }))
  return { supabase: { from } as any, from }
}

describe('retryShare — full-access gate (E02-S01 / audit C6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a user without full access to the code gate, touching neither the DB nor Inngest', async () => {
    const { supabase, from } = supabaseStub(null)
    vi.mocked(requireUser).mockResolvedValue({ supabase, user: USER } as any)
    vi.mocked(getFullAccess).mockResolvedValue(false)

    await expect(retryShare(1)).rejects.toThrow('REDIRECT /dodaj?add_error=no_access')

    expect(from).not.toHaveBeenCalled()
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('resets a failed share to pending and re-dispatches extraction with full access', async () => {
    const { supabase } = supabaseStub(
      { id: 42, shared_url: 'https://example.com/tiramisu', share_intent: { title: 'Tiramisu' }, status: 'failed' },
      { data: [{ id: 42 }], error: null },
    )
    vi.mocked(requireUser).mockResolvedValue({ supabase, user: USER } as any)
    vi.mocked(getFullAccess).mockResolvedValue(true)

    await retryShare(42)

    expect(inngest.send).toHaveBeenCalledTimes(1)
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'recipe/extract',
        data: expect.objectContaining({ shareId: 42, userId: 'user-1' }),
      }),
    )
  })

  it('does nothing for a share whose status is not failed', async () => {
    const { supabase } = supabaseStub({ id: 42, shared_url: 'https://example.com/x', share_intent: {}, status: 'pending' })
    vi.mocked(requireUser).mockResolvedValue({ supabase, user: USER } as any)
    vi.mocked(getFullAccess).mockResolvedValue(true)

    await retryShare(42)

    expect(inngest.send).not.toHaveBeenCalled()
  })
})
