import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { dedupeCanonical, listCanonicalRecipes } from './public-recipe'

type Row = { slug: string; created_at: string; id: number; last_modified?: string | null }

/**
 * Chainable public_recipes stub: records the selected columns and the .range()
 * window, then resolves to the matching slice. `undefinedColumn` makes the first
 * select that names last_modified fail like PostgREST 42703.
 */
function makeSupabase(dataset: Row[], opts: { undefinedColumn?: boolean } = {}) {
  const from = (table: string) => {
    expect(table).toBe('public_recipes')
    let columns = ''
    let range: [number, number] = [0, dataset.length]
    const builder: Record<string, unknown> = {
      select: (c: string) => {
        columns = c
        return builder
      },
      order: () => builder,
      range: (a: number, b: number) => {
        range = [a, b]
        return builder
      },
      returns: () => builder,
      then: (resolve: (r: { data: Row[] | null; error: unknown }) => void) => {
        if (opts.undefinedColumn && columns.includes('last_modified')) {
          return resolve({ data: null, error: { code: '42703', message: 'column public_recipes.last_modified does not exist' } })
        }
        const slice = dataset.slice(range[0], range[1] + 1).map((r) => {
          const row: Row = { slug: r.slug, created_at: r.created_at, id: r.id }
          if (columns.includes('last_modified')) row.last_modified = r.last_modified ?? null
          return row
        })
        return resolve({ data: slice, error: null })
      },
    }
    return builder
  }
  return { from } as unknown
}

describe('dedupeCanonical', () => {
  it('keeps the first (oldest) row per slug', () => {
    const out = dedupeCanonical([
      { slug: 'sernik', created_at: '2026-01-01T00:00:00Z' },
      { slug: 'sernik', created_at: '2026-02-01T00:00:00Z' },
      { slug: 'piernik', created_at: '2026-03-01T00:00:00Z' },
    ])
    expect(out).toEqual([
      { slug: 'sernik', lastModified: '2026-01-01T00:00:00Z' },
      { slug: 'piernik', lastModified: '2026-03-01T00:00:00Z' },
    ])
  })

  it('prefers last_modified over created_at when present', () => {
    const out = dedupeCanonical([
      { slug: 'sernik', created_at: '2026-01-01T00:00:00Z', last_modified: '2026-05-09T12:00:00Z' },
      { slug: 'piernik', created_at: '2026-03-01T00:00:00Z', last_modified: null },
    ])
    expect(out[0].lastModified).toBe('2026-05-09T12:00:00Z')
    expect(out[1].lastModified).toBe('2026-03-01T00:00:00Z')
  })
})

describe('listCanonicalRecipes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads last_modified and dedupes by slug', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeSupabase([
        { slug: 'sernik', created_at: '2026-01-01T00:00:00Z', id: 1, last_modified: '2026-06-01T00:00:00Z' },
        { slug: 'sernik', created_at: '2026-02-01T00:00:00Z', id: 2, last_modified: '2026-07-01T00:00:00Z' },
        { slug: 'piernik', created_at: '2026-03-01T00:00:00Z', id: 3, last_modified: null },
      ]) as never,
    )
    const out = await listCanonicalRecipes()
    expect(out).toEqual([
      { slug: 'sernik', lastModified: '2026-06-01T00:00:00Z' },
      { slug: 'piernik', lastModified: '2026-03-01T00:00:00Z' },
    ])
  })

  it('falls back to created_at when the last_modified column is missing', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeSupabase(
        [{ slug: 'sernik', created_at: '2026-01-01T00:00:00Z', id: 1 }],
        { undefinedColumn: true },
      ) as never,
    )
    const out = await listCanonicalRecipes()
    expect(out).toEqual([{ slug: 'sernik', lastModified: '2026-01-01T00:00:00Z' }])
  })

  it('pages past the row cap to list the whole catalog', async () => {
    const dataset: Row[] = Array.from({ length: 1001 }, (_, i) => ({
      slug: `r-${i}`,
      created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
      id: i,
    }))
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeSupabase(dataset) as never)
    const out = await listCanonicalRecipes()
    expect(out).toHaveLength(1001)
    expect(out[1000].slug).toBe('r-1000')
  })
})
