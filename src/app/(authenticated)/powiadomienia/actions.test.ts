import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect() ends the action by throwing, as Next's does.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/supabase/server'
import { clearReadShares, openReadyShare } from './actions'

type Result = { data?: unknown; error?: unknown }
type Call = [string, ...unknown[]]

/** Chainable stub: each query records its calls and resolves to `answer(table, calls)`. */
function makeSupabase(answer: (table: string, calls: Call[]) => Result) {
  const queries: Array<{ table: string; calls: Call[] }> = []
  const from = (table: string) => {
    const calls: Call[] = []
    queries.push({ table, calls })
    const q: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') return (resolve: (r: Result) => void) => resolve(answer(table, calls))
          return (...args: unknown[]) => {
            calls.push([prop, ...args])
            return q
          }
        },
      },
    )
    return q
  }
  return { client: { from } as any, queries }
}

const isUpdate = (calls: Call[]) => calls.some((c) => c[0] === 'update')

function form(shareId: string) {
  const data = new FormData()
  data.set('shareId', shareId)
  return data
}

function signIn(client: unknown) {
  vi.mocked(requireUser).mockResolvedValue({ supabase: client, user: { id: 'user-1' } } as any)
}

describe('openReadyShare', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the own completed share read (first open only) and opens the recipe', async () => {
    const { client, queries } = makeSupabase((table, calls) => {
      if (table === 'public_recipes') return { data: { slug: 'sernik' } }
      return isUpdate(calls) ? { error: null } : { data: { recipe_id: 100 } }
    })
    signIn(client)

    await expect(openReadyShare(form('3'))).rejects.toThrow('REDIRECT /przepis/sernik')

    const update = queries.find((q) => isUpdate(q.calls))!
    expect(update.calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(update.calls).toContainEqual(['eq', 'status', 'completed'])
    expect(update.calls).toContainEqual(['is', 'read_at', null])
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('goes back to /powiadomienia when the recipe is gone', async () => {
    const { client } = makeSupabase((table, calls) => {
      if (table === 'public_recipes') return { data: null }
      return isUpdate(calls) ? { error: null } : { data: { recipe_id: 101 } }
    })
    signIn(client)

    await expect(openReadyShare(form('3'))).rejects.toThrow('REDIRECT /powiadomienia')
  })

  it('rejects a malformed id without touching the database', async () => {
    await expect(openReadyShare(form('abc'))).rejects.toThrow('REDIRECT /powiadomienia')
    expect(requireUser).not.toHaveBeenCalled()
  })
})

describe('clearReadShares', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hides only the user’s read, not yet cleared, completed shares — never deletes', async () => {
    const { client, queries } = makeSupabase(() => ({ error: null }))
    signIn(client)

    await clearReadShares()

    expect(queries).toHaveLength(1)
    const calls = queries[0].calls
    expect(calls.map((c) => c[0])).not.toContain('delete')
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(calls).toContainEqual(['eq', 'status', 'completed'])
    expect(calls).toContainEqual(['not', 'read_at', 'is', null])
    expect(calls).toContainEqual(['is', 'cleared_at', null])
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})
