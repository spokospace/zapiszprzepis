import { describe, it, expect, vi } from 'vitest'
import { getFailedShares } from '@/lib/failed-shares'

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
) {
  const sharesQuery = { select: () => sharesQuery, eq: () => sharesQuery, is: () => sharesQuery, order: async () => shares }
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

const share = (id: number, url: string) => ({ id, shared_url: url, error_message: null })

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
      shares: [share(3, 'https://a.example'), share(1, 'https://b.example')],
    })
  })

  it('drops shares whose URL already has a recipe and dedupes the rest', async () => {
    const supabase = makeSupabase(
      { data: [share(3, 'https://a.example'), share(2, 'https://b.example'), share(1, 'https://b.example')], error: null },
      { data: [{ source_url: 'https://a.example' }], error: null },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', shares: [share(2, 'https://b.example')] })
  })

  it('reports an empty bell when nothing failed', async () => {
    const supabase = makeSupabase({ data: [], error: null })

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', shares: [] })
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

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', shares: [share(1, 'https://b.example')] })
  })

  it('resolves nothing through favorites when their lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(1, 'https://a.example')], error: null },
      { data: [], error: null },
      { data: null, error: { message: 'upstream 503' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', shares: [share(1, 'https://a.example')] })
  })

  it('resolves nothing when the favorited recipes cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(1, 'https://a.example')], error: null },
      { data: [], error: null },
      { data: [{ recipe_id: 7 }], error: null },
      { data: null, error: { message: 'upstream 503' } },
    )

    expect(await getFailedShares(supabase, USER)).toEqual({ status: 'ok', shares: [share(1, 'https://a.example')] })
  })
})
