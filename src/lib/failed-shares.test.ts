import { describe, it, expect, vi } from 'vitest'
import { getFailedShares } from '@/lib/failed-shares'
import { STALE_PENDING_ERROR } from '@/lib/share-staleness'

// failed-shares is server-only; the guard throws outside a server bundle.
vi.mock('server-only', () => ({}))

type Result = { data: unknown; error: unknown }

const USER = 'user-1'

/**
 * A Supabase client answering the recipe_shares query, the own-recipes lookup,
 * and the favorites → public_recipes lookup of favorited links (E01-S03a).
 */
function makeSupabase(
  shares: Result,
  recipes: Result = { data: [], error: null },
  favorites: Result = { data: [], error: null },
  favoritedRecipes: Result = { data: [], error: null },
  pending: Result = { data: [], error: null },
  unread: Result = { data: [], error: null },
) {
  // The failed-rows query ends in order(); the pending-URL lookup (E01-S15) ends in in().
  const sharesQuery = {
    select: () => sharesQuery,
    eq: () => sharesQuery,
    neq: () => sharesQuery,
    is: () => sharesQuery,
    order: async () => shares,
    in: async () => pending,
    not: () => sharesQuery,
    gte: () => sharesQuery,
    // The unread-ready count (E01-S15) ends in limit().
    limit: async () => unread,
  }
  const recipesQuery = { select: () => recipesQuery, eq: () => recipesQuery, in: async () => recipes }
  const favoritesQuery = { select: () => favoritesQuery, eq: async () => favorites }
  const publicQuery: any = {
    select: () => publicQuery,
    in: () => publicQuery,
    then: (resolve: (r: Result) => void) => resolve(favoritedRecipes),
  }
  const tables: Record<string, unknown> = {
    recipe_shares: sharesQuery,
    recipes: recipesQuery,
    favorites: favoritesQuery,
    public_recipes: publicQuery,
  }
  return { from: (table: string) => tables[table] } as any
}

const share = (id: number, url: string) => ({ id, shared_url: url, error_message: null, status: 'failed' })

describe('getFailedShares — the bell never shows a silent zero', () => {
  it('reports an error, not an empty list, when the shares query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase({ data: null, error: { message: 'JWT expired' } })

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'error' })
  })

  it('lists every failed share, deduped, when the auto-resolve lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(3, 'https://a.example'), share(2, 'https://a.example'), share(1, 'https://b.example')], error: null },
      { data: null, error: { message: 'upstream 503' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({
      status: 'ok',
      unreadReady: 0,
      shares: [share(3, 'https://a.example'), share(1, 'https://b.example')],
    })
  })

  it('drops shares whose URL already has a recipe and dedupes the rest', async () => {
    const supabase = makeSupabase(
      { data: [share(3, 'https://a.example'), share(2, 'https://b.example'), share(1, 'https://b.example')], error: null },
      { data: [{ source_url: 'https://a.example' }], error: null },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(2, 'https://b.example')] })
  })

  it('reports an empty bell when nothing failed', async () => {
    const supabase = makeSupabase({ data: [], error: null })

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [] })
  })

  // E01-S02 regression: the auto-resolve lookup must be scoped to the current user
  // (not left to RLS) — otherwise, whenever recipes are readable across users,
  // another user saving the same URL would hide this user's failed share.
  it("scopes the auto-resolve lookup to the current user's own recipes", async () => {
    const supabase = makeSupabase({ data: [share(1, 'https://a.example')], error: null })
    // from() hands back the same query object every call, so the spy sees the lookup.
    const eq = vi.spyOn(supabase.from('recipes'), 'eq')

    await getFailedShares(supabase, USER)

    expect(eq).toHaveBeenCalledWith('user_id', USER)
  })
})

describe('getFailedShares — a link that landed in favorites is resolved (E01-S03a)', () => {
  it("drops a failed share whose link is a favorited recipe's source", async () => {
    const supabase = makeSupabase(
      { data: [share(2, 'https://a.example'), share(1, 'https://b.example')], error: null },
      { data: [], error: null },
      { data: [{ recipe_id: 7 }], error: null },
      { data: [{ source_url: 'https://a.example' }], error: null },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(1, 'https://b.example')] })
  })

  it('resolves nothing through favorites when their lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(1, 'https://a.example')], error: null },
      { data: [], error: null },
      { data: null, error: { message: 'upstream 503' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(1, 'https://a.example')] })
  })

  it('resolves nothing when the favorited recipes cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(1, 'https://a.example')], error: null },
      { data: [], error: null },
      { data: [{ recipe_id: 7 }], error: null },
      { data: null, error: { message: 'upstream 503' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(1, 'https://a.example')] })
  })
})

describe('getFailedShares — a re-added link is in progress, not a problem (E01-S15)', () => {
  it('drops a failed URL that has a pending row, scoped to the user', async () => {
    const supabase = makeSupabase(
      { data: [share(3, 'https://a.example'), share(1, 'https://b.example')], error: null },
      undefined,
      undefined,
      undefined,
      { data: [{ shared_url: 'https://a.example' }], error: null },
    )
    const eq = vi.spyOn(supabase.from('recipe_shares'), 'eq')

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(1, 'https://b.example')] })
    expect(eq).toHaveBeenCalledWith('user_id', USER)
    expect(eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('keeps every failed share when the pending lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(1, 'https://a.example')], error: null },
      undefined,
      undefined,
      undefined,
      { data: null, error: { message: 'boom' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(1, 'https://a.example')] })
  })
})

describe('getFailedShares — unread ready recipes for the badge (E01-S15)', () => {
  it('returns the unread count next to the problems, one per recipe', async () => {
    // Recipe 7 was shared twice: the page shows one card for it, so it counts once.
    const unread = { data: [{ recipe_id: 7 }, { recipe_id: 7 }, { recipe_id: 8 }, { recipe_id: 9 }], error: null }
    const supabase = makeSupabase({ data: [], error: null }, undefined, undefined, undefined, undefined, unread)

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 3, shares: [] })
  })

  it('counts 0 instead of failing when the count errors (migration not applied yet)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(1, 'https://a.example')], error: null },
      undefined,
      undefined,
      undefined,
      undefined,
      { data: null, error: { message: 'column recipe_shares.read_at does not exist' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [share(1, 'https://a.example')] })
  })
})

describe('getFailedShares — a share stuck in pending is a problem (#382)', () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString()
  const pendingShare = (id: number, url: string, updatedMinutesAgo: number) => ({
    id,
    shared_url: url,
    error_message: null,
    status: 'pending',
    updated_at: minutesAgo(updatedMinutesAgo),
  })

  it('lists a share pending for more than 15 minutes as failed, with a reason the reader understands', async () => {
    const stale = pendingShare(4, 'https://a.example', 16)
    const supabase = makeSupabase({ data: [stale], error: null })

    expect(await getFailedShares(supabase, USER)).toEqual({
      status: 'ok',
      unreadReady: 0,
      shares: [{ ...stale, error_message: STALE_PENDING_ERROR }],
    })
  })

  it('keeps a share pending for 2 minutes in progress, not in the bell', async () => {
    const supabase = makeSupabase({ data: [pendingShare(4, 'https://a.example', 2)], error: null })

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', unreadReady: 0, shares: [] })
  })

  it('does not let a stale pending row hide an older failed row for the same link', async () => {
    const stale = pendingShare(4, 'https://a.example', 30)
    const supabase = makeSupabase(
      { data: [stale, share(1, 'https://a.example')], error: null },
      undefined,
      undefined,
      undefined,
      { data: [{ shared_url: 'https://a.example', status: 'pending', updated_at: stale.updated_at }], error: null },
    )

    const result = await getFailedShares(supabase, USER)
    expect(result).toMatchObject({ status: 'ok', shares: [{ id: 4, shared_url: 'https://a.example' }] })
  })
})
