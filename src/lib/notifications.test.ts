import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFailedShares } from '@/lib/failed-shares'
import { getNotifications } from '@/lib/notifications'
import { REASON_BLOCKED } from '@/lib/share-error'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/failed-shares', () => ({ getFailedShares: vi.fn() }))

type Result = { data: unknown; error: unknown }
type Call = [string, ...unknown[]]

const USER = 'user-1'
const NOW = new Date('2026-10-17T12:00:00Z')

/**
 * A chainable Supabase stub: every query records its filter calls and resolves
 * to `answer(table, calls)` when awaited, so a test answers by table + status.
 */
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

const status = (calls: Call[]) => calls.find((c) => c[0] === 'eq' && c[1] === 'status')?.[2]

const ok = (data: unknown): Result => ({ data, error: null })

describe('getNotifications', () => {
  beforeEach(() => {
    vi.mocked(getFailedShares).mockResolvedValue({
      status: 'ok',
      shares: [{ id: 9, shared_url: 'https://www.aniagotuje.pl/x', error_message: 'Firecrawl failed: HTTP 403 Forbidden' }],
    })
  })

  it('groups problems, in-progress and done, with plain reasons and recipe titles', async () => {
    const { client } = makeSupabase((table, calls) => {
      if (table === 'public_recipes') return ok([{ id: 100, slug: 'sernik', title: 'Sernik' }])
      if (status(calls) === 'pending') {
        return ok([
          { id: 5, shared_url: 'https://kwestiasmaku.com/a', created_at: '2026-10-17T11:59:00Z' },
          { id: 4, shared_url: 'https://kwestiasmaku.com/a', created_at: '2026-10-17T11:58:00Z' },
          { id: 6, shared_url: 'https://stuck.pl/b', created_at: '2026-10-17T11:30:00Z' },
        ])
      }
      return ok([
        { id: 3, shared_url: 'https://mojewypieki.com/s', recipe_id: 100, created_at: '2026-10-16T10:00:00Z' },
        { id: 2, shared_url: 'https://mojewypieki.com/s', recipe_id: 100, created_at: '2026-10-15T10:00:00Z' },
        { id: 1, shared_url: 'https://gone.pl/r', recipe_id: 101, created_at: '2026-10-14T10:00:00Z' },
      ])
    })

    expect(await getNotifications(client, USER, NOW)).toEqual({
      status: 'ok',
      problems: [{ id: 9, url: 'https://www.aniagotuje.pl/x', domain: 'aniagotuje.pl', reason: REASON_BLOCKED }],
      inProgress: [
        { id: 5, url: 'https://kwestiasmaku.com/a', domain: 'kwestiasmaku.com', since: '2026-10-17T11:59:00Z', slow: false },
        // 30 minutes pending → "trwa dłużej niż zwykle".
        { id: 6, url: 'https://stuck.pl/b', domain: 'stuck.pl', since: '2026-10-17T11:30:00Z', slow: true },
      ],
      // 101 is gone from public_recipes → skipped, never a dead link.
      done: [
        { id: 3, url: 'https://mojewypieki.com/s', domain: 'mojewypieki.com', slug: 'sernik', title: 'Sernik', at: '2026-10-16T10:00:00Z' },
      ],
    })
  })

  it('scopes both share queries to the user and limits "Wcześniej" to 14 days', async () => {
    const { client, queries } = makeSupabase(() => ok([]))

    await getNotifications(client, USER, NOW)

    const shareQueries = queries.filter((q) => q.table === 'recipe_shares')
    expect(shareQueries).toHaveLength(2)
    for (const q of shareQueries) expect(q.calls).toContainEqual(['eq', 'user_id', USER])
    const done = shareQueries.find((q) => status(q.calls) === 'completed')!
    expect(done.calls).toContainEqual(['gte', 'created_at', '2026-10-03T12:00:00.000Z'])
  })

  it('reports an error when the failed shares could not be checked', async () => {
    vi.mocked(getFailedShares).mockResolvedValue({ status: 'error' })
    const { client } = makeSupabase(() => ok([]))

    expect(await getNotifications(client, USER, NOW)).toEqual({ status: 'error' })
  })

  it('reports an error when the pending query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = makeSupabase((_t, calls) => (status(calls) === 'pending' ? { data: null, error: { message: 'x' } } : ok([])))

    expect(await getNotifications(client, USER, NOW)).toEqual({ status: 'error' })
  })

  it('drops "Wcześniej" but keeps the rest when recipe titles fail to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = makeSupabase((table, calls) => {
      if (table === 'public_recipes') return { data: null, error: { message: 'x' } }
      if (status(calls) === 'completed') return ok([{ id: 3, shared_url: 'https://a.pl', recipe_id: 1, created_at: '2026-10-16T10:00:00Z' }])
      return ok([])
    })

    const result = await getNotifications(client, USER, NOW)
    expect(result.status === 'ok' && result.done).toEqual([])
    expect(result.status === 'ok' && result.problems).toHaveLength(1)
  })
})
