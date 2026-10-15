import { describe, it, expect, vi } from 'vitest'
import { getFailedShares } from '@/lib/failed-shares'

// failed-shares is server-only; the guard throws outside a server bundle.
vi.mock('server-only', () => ({}))

type Result = { data: unknown; error: unknown }

/** A Supabase client answering the recipe_shares query and the recipes lookup. */
function makeSupabase(shares: Result, recipes: Result = { data: [], error: null }) {
  const sharesQuery = { select: () => sharesQuery, eq: () => sharesQuery, is: () => sharesQuery, order: async () => shares }
  const recipesQuery = { select: () => recipesQuery, in: async () => recipes }
  return { from: (table: string) => (table === 'recipe_shares' ? sharesQuery : recipesQuery) } as any
}

const share = (id: number, url: string) => ({ id, shared_url: url, error_message: null })

describe('getFailedShares — the bell never shows a silent zero', () => {
  it('reports an error, not an empty list, when the shares query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase({ data: null, error: { message: 'JWT expired' } })

    expect(await getFailedShares(supabase)).toEqual({ status: 'error' })
  })

  it('lists every failed share, deduped, when the auto-resolve lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase(
      { data: [share(3, 'https://a.example'), share(2, 'https://a.example'), share(1, 'https://b.example')], error: null },
      { data: null, error: { message: 'upstream 503' } },
    )

    expect(await getFailedShares(supabase)).toEqual({
      status: 'ok',
      shares: [share(3, 'https://a.example'), share(1, 'https://b.example')],
    })
  })

  it('drops shares whose URL already has a recipe and dedupes the rest', async () => {
    const supabase = makeSupabase(
      { data: [share(3, 'https://a.example'), share(2, 'https://b.example'), share(1, 'https://b.example')], error: null },
      { data: [{ source_url: 'https://a.example' }], error: null },
    )

    expect(await getFailedShares(supabase)).toEqual({ status: 'ok', shares: [share(2, 'https://b.example')] })
  })

  it('reports an empty bell when nothing failed', async () => {
    const supabase = makeSupabase({ data: [], error: null })

    expect(await getFailedShares(supabase)).toEqual({ status: 'ok', shares: [] })
  })
})
