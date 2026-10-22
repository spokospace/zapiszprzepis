import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
  getSignedInUser: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/app/components/recipe-list-snapshot', () => ({ RecipeListSnapshot: () => null }))
vi.mock('@/app/components/recipe-card', () => ({
  TILE_SIZES_1_TO_3: '',
  RecipeCard: ({ slug }: { slug: string }) => createElement('a', { href: `/przepis/${slug}` }, slug),
}))

import { createSupabaseServerClient, getSignedInUser } from '@/lib/supabase/server'
import FavoritesPage from './page'

function card(n: number) {
  return {
    id: n,
    slug: `p${n}`,
    title: `P${n}`,
    image_url: null,
    category: 'zupy',
    description: null,
    source_type: 'web_blog',
    source_url: null,
    source_author: null,
  }
}

type Row = { recipe: ReturnType<typeof card> | null }

/** A signed-in client whose `favorites` query answers `rows`, capturing the chain. */
function mockFavorites(rows: Row[]) {
  const calls = {
    from: [] as string[],
    select: [] as string[],
    eq: [] as [string, unknown][],
    order: [] as [string, unknown][],
  }
  // A thenable builder: every step chains, and awaiting it (after `.returns()`)
  // resolves to the PostgREST-shaped result.
  const query = {
    select: (s: string) => {
      calls.select.push(s)
      return query
    },
    eq: (col: string, val: unknown) => {
      calls.eq.push([col, val])
      return query
    },
    order: (col: string, opts: unknown) => {
      calls.order.push([col, opts])
      return query
    },
    returns: () => query,
    then: (resolve: (r: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
  }
  const client = {
    from: (table: string) => {
      calls.from.push(table)
      return query
    },
  }
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never)
  vi.mocked(getSignedInUser).mockResolvedValue({ id: 'u1' } as never)
  return calls
}

async function render(rows: Row[]) {
  const calls = mockFavorites(rows)
  const html = renderToStaticMarkup(await FavoritesPage())
  return { calls, html }
}

describe('ulubione page — one query (#231)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the favorites in a single embedded request, scoped and ordered', async () => {
    const { calls } = await render([{ recipe: card(1) }])
    // One round trip: only `favorites`, never a second top-level `public_recipes` read.
    expect(calls.from).toEqual(['favorites'])
    expect(calls.select[0]).toContain('recipe:public_recipes(')
    expect(calls.eq).toContainEqual(['user_id', 'u1'])
    expect(calls.order).toContainEqual(['created_at', { ascending: false }])
  })

  it('keeps the query order and drops favorites whose recipe is gone', async () => {
    const { html } = await render([{ recipe: card(3) }, { recipe: null }, { recipe: card(1) }])
    const slugs = [...html.matchAll(/\/przepis\/(p\d+)/g)].map((m) => m[1])
    expect(slugs).toEqual(['p3', 'p1'])
  })

  it('shows the empty state when there are no favorites', async () => {
    const { html } = await render([])
    expect(html).toContain('Nie masz jeszcze ulubionych')
  })
})
