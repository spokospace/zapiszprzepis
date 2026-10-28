import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/staff/context', () => ({ requirePermission: vi.fn() }))
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn() } }))

import { inngest } from '@/inngest/client'
import { requirePermission } from '@/lib/staff/context'
import { retryImport } from './actions'

const USER = '3f2b8a52-5b0c-4d8e-9a55-0c1d2e3f4a5b'
const PAYLOAD = { shareId: 7, sharedUrl: 'https://blog.example/sernik', sharedTitle: null, sharedText: null, userId: USER }

function staffRpc(answers: Record<string, { data?: unknown; error?: { message: string } | null }>) {
  const rpc = vi.fn(async (fn: string) => ({ data: null, error: null, ...answers[fn] }))
  vi.mocked(requirePermission).mockResolvedValue({ supabase: { rpc }, user: { id: 's' }, permissions: new Set() } as never)
  return rpc
}

function form(shareId: string) {
  const data = new FormData()
  data.set('shareId', shareId)
  return data
}

async function redirectOf(run: Promise<unknown>) {
  try {
    await run
  } catch (e) {
    return (e as Error).message
  }
  return null
}

describe('retryImport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('answers 404 for staff without imports.retry and touches nothing', async () => {
    vi.mocked(requirePermission).mockImplementation(async () => {
      throw new Error('NOT_FOUND')
    })
    await expect(retryImport(form('7'))).rejects.toThrow('NOT_FOUND')
    expect(requirePermission).toHaveBeenCalledWith('imports.retry')
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('refuses a share id that is not a positive integer', async () => {
    const rpc = staffRpc({})
    expect(await redirectOf(retryImport(form('-3')))).toBe('REDIRECT /admin/importy?error=invalid_input')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends the recipe/extract event for the original sharer after the database accepts the retry', async () => {
    staffRpc({ admin_retry_import: { data: PAYLOAD } })
    expect(await redirectOf(retryImport(form('7')))).toBe('REDIRECT /admin/importy?ok=retried')
    expect(inngest.send).toHaveBeenCalledWith({
      name: 'recipe/extract',
      data: {
        shareId: 7,
        sharedUrl: 'https://blog.example/sernik',
        sharedTitle: undefined,
        sharedText: undefined,
        sourceType: 'web_blog',
        userId: USER,
      },
    })
  })

  it('does not send anything when the share is not retryable (completed, or already retried)', async () => {
    staffRpc({ admin_retry_import: { error: { message: 'not_retryable' } } })
    expect(await redirectOf(retryImport(form('7')))).toBe('REDIRECT /admin/importy?error=not_retryable')
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('puts the share back to failed when Inngest cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = staffRpc({ admin_retry_import: { data: PAYLOAD } })
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error('down'))
    expect(await redirectOf(retryImport(form('7')))).toBe('REDIRECT /admin/importy?error=dispatch_failed')
    expect(rpc).toHaveBeenCalledWith('admin_import_dispatch_failed', { p_share: 7 })
  })
})
