import { describe, it, expect, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { getMenuSummary } from '@/lib/menu-summary'

// menu-summary and full-access are server-only; the guard throws outside a server bundle.
vi.mock('server-only', () => ({}))

type CountResult = { count: number | null; error: unknown }

const USER = { id: 'user-1' } as User

function makeSupabase(results: Record<string, CountResult>, fullAccess = true) {
  const calls: { table: string; userId: unknown }[] = []
  const supabase = {
    // getFullAccess() reads the has_full_access() RPC (E01-S11).
    rpc: async (fn: string) => {
      expect(fn).toBe('has_full_access')
      return { data: fullAccess, error: null }
    },
    from: (table: string) => ({
      select: (_cols: string, opts: { count: string; head: boolean }) => {
        expect(opts).toEqual({ count: 'exact', head: true })
        return {
          eq: async (column: string, userId: unknown) => {
            expect(column).toBe('user_id')
            calls.push({ table, userId })
            return results[table]
          },
        }
      },
    }),
  } as any
  return { supabase, calls }
}

describe('getMenuSummary', () => {
  it('returns null for a guest without querying', async () => {
    const { supabase, calls } = makeSupabase({})
    expect(await getMenuSummary(supabase, null)).toBeNull()
    expect(calls).toEqual([])
  })

  it('counts the user’s own recipes and favorites', async () => {
    const { supabase, calls } = makeSupabase({
      recipes: { count: 7, error: null },
      favorites: { count: 3, error: null },
    })
    expect(await getMenuSummary(supabase, USER)).toEqual({
      hasFullAccess: true,
      myRecipesCount: 7,
      favoritesCount: 3,
    })
    expect(calls).toEqual([
      { table: 'recipes', userId: 'user-1' },
      { table: 'favorites', userId: 'user-1' },
    ])
  })

  it('reports no full access when the RPC says so (lock on "Dodaj przepis")', async () => {
    const { supabase } = makeSupabase(
      { recipes: { count: 0, error: null }, favorites: { count: 2, error: null } },
      false,
    )
    expect(await getMenuSummary(supabase, USER)).toEqual({
      hasFullAccess: false,
      myRecipesCount: 0,
      favoritesCount: 2,
    })
  })

  it('hides a counter (null), never a false zero, when its query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { supabase } = makeSupabase({
      recipes: { count: null, error: { message: 'JWT expired' } },
      favorites: { count: 0, error: null },
    })
    expect(await getMenuSummary(supabase, USER)).toEqual({
      hasFullAccess: true,
      myRecipesCount: null,
      favoritesCount: 0,
    })
  })
})
