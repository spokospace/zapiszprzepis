import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFailedShares } from '@/lib/failed-shares'
import { getNotifications } from '@/lib/notifications'
import { REASON_BLOCKED } from '@/lib/share-error'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/failed-shares', () => ({
  getFailedShares: vi.fn(),
  readyWindowStart: (now: Date) => new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
}))

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
      unreadReady: 1,
      shares: [
        {
          id: 9,
          shared_url: 'https://www.aniagotuje.pl/x',
          error_message: 'Firecrawl failed: HTTP 403 Forbidden',
          created_at: '2026-10-17T07:40:00Z',
        },
      ],
    })
  })

  it('groups problems, in-progress and ready (read/unread), with plain reasons and recipe titles', async () => {
    const { client } = makeSupabase((table, calls) => {
      if (table === 'public_recipes') {
        return ok([
          { id: 100, slug: 'sernik', title: 'Sernik' },
          { id: 102, slug: 'placki', title: 'Placki' },
        ])
      }
      if (status(calls) === 'pending') {
        return ok([
          { id: 5, shared_url: 'https://kwestiasmaku.com/a', created_at: '2026-10-17T11:59:00Z' },
          { id: 4, shared_url: 'https://kwestiasmaku.com/a', created_at: '2026-10-17T11:58:00Z' },
          { id: 6, shared_url: 'https://stuck.pl/b', created_at: '2026-10-17T11:30:00Z' },
        ])
      }
      return ok([
        { id: 3, shared_url: 'https://mojewypieki.com/s', recipe_id: 100, created_at: '2026-10-16T10:00:00Z', read_at: null },
        { id: 2, shared_url: 'https://mojewypieki.com/s', recipe_id: 100, created_at: '2026-10-15T10:00:00Z', read_at: null },
        { id: 1, shared_url: 'https://gone.pl/r', recipe_id: 101, created_at: '2026-10-14T10:00:00Z', read_at: null },
        { id: 0, shared_url: 'https://www.placki.pl/p', recipe_id: 102, created_at: '2026-10-13T10:00:00Z', read_at: '2026-10-13T11:00:00Z' },
      ])
    })

    expect(await getNotifications(client, USER, NOW)).toEqual({
      status: 'ok',
      problems: [{ id: 9, url: 'https://www.aniagotuje.pl/x', domain: 'aniagotuje.pl', reason: REASON_BLOCKED, at: '2026-10-17T07:40:00Z' }],
      inProgress: [
        { id: 5, url: 'https://kwestiasmaku.com/a', domain: 'kwestiasmaku.com', at: '2026-10-17T11:59:00Z', slow: false },
        // 30 minutes pending → "trwa dłużej niż zwykle".
        { id: 6, url: 'https://stuck.pl/b', domain: 'stuck.pl', at: '2026-10-17T11:30:00Z', slow: true },
      ],
      // 101 is gone from public_recipes → skipped, never a dead link.
      ready: [
        { id: 3, url: 'https://mojewypieki.com/s', domain: 'mojewypieki.com', slug: 'sernik', title: 'Sernik', at: '2026-10-16T10:00:00Z', read: false },
        { id: 0, url: 'https://www.placki.pl/p', domain: 'placki.pl', slug: 'placki', title: 'Placki', at: '2026-10-13T10:00:00Z', read: true },
      ],
    })
  })

  it('leaves a share stuck in pending out of „W trakcie”, where getFailedShares lists it as a problem (#382)', async () => {
    const { client } = makeSupabase((_t, calls) =>
      status(calls) === 'pending'
        ? ok([
            { id: 7, shared_url: 'https://stuck.pl/c', created_at: '2026-10-17T11:00:00Z', updated_at: '2026-10-17T11:40:00Z' },
            { id: 8, shared_url: 'https://fresh.pl/d', created_at: '2026-10-17T11:58:00Z', updated_at: '2026-10-17T11:58:00Z' },
          ])
        : ok([]),
    )

    const result = await getNotifications(client, USER, NOW)

    expect(result).toMatchObject({ status: 'ok', inProgress: [{ id: 8, url: 'https://fresh.pl/d' }] })
    if (result.status === 'ok') expect(result.inProgress).toHaveLength(1)
  })

  it('scopes both share queries to the user, skips cleared rows and limits ready items to 14 days', async () => {
    const { client, queries } = makeSupabase(() => ok([]))

    await getNotifications(client, USER, NOW)

    const shareQueries = queries.filter((q) => q.table === 'recipe_shares')
    expect(shareQueries).toHaveLength(2)
    for (const q of shareQueries) expect(q.calls).toContainEqual(['eq', 'user_id', USER])
    const ready = shareQueries.find((q) => status(q.calls) === 'completed')!
    expect(ready.calls).toContainEqual(['gte', 'created_at', '2026-10-03T12:00:00.000Z'])
    expect(ready.calls).toContainEqual(['is', 'cleared_at', null])
  })

  it('reports an error when the failed shares could not be checked', async () => {
    vi.mocked(getFailedShares).mockResolvedValue({ status: 'error' })
    const { client } = makeSupabase(() => ok([]))

    expect(await getNotifications(client, USER, NOW)).toEqual({ status: 'error' })
  })

  it('reports an error when the completed query fails (e.g. migration not applied)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = makeSupabase((_t, calls) =>
      status(calls) === 'completed' ? { data: null, error: { message: 'column read_at does not exist' } } : ok([]),
    )

    expect(await getNotifications(client, USER, NOW)).toEqual({ status: 'error' })
  })

  it('drops the ready sections but keeps the rest when recipe titles fail to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = makeSupabase((table, calls) => {
      if (table === 'public_recipes') return { data: null, error: { message: 'x' } }
      if (status(calls) === 'completed') {
        return ok([{ id: 3, shared_url: 'https://a.pl', recipe_id: 1, created_at: '2026-10-16T10:00:00Z', read_at: null }])
      }
      return ok([])
    })

    const result = await getNotifications(client, USER, NOW)
    expect(result.status === 'ok' && result.ready).toEqual([])
    expect(result.status === 'ok' && result.problems).toHaveLength(1)
  })
})
