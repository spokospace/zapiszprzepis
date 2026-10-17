import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

import { createSupabaseServerClient, getCurrentUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RecipeLayout from './layout'

/** A guest's client whose public_recipes lookup answers `rows` (or `error`). */
function mockRecipes(rows: object[], error: object | null = null) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: error ? null : rows, error }),
  }
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: () => query } as any)
  vi.mocked(getCurrentUser).mockResolvedValue(null)
}

const render = (slug: string) => RecipeLayout({ children: 'page', params: Promise.resolve({ slug }) })

// loading.tsx streams the skeleton before the page runs, so the layout is the last
// place a missing recipe can still get a 404 status (#227).
describe('przepis/[slug] layout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls notFound() for a missing recipe', async () => {
    mockRecipes([])
    await expect(render('nie-ma')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('calls notFound() when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRecipes([], { message: 'boom' })
    await expect(render('zupa')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('renders the page for an existing recipe', async () => {
    mockRecipes([{ id: 1, slug: 'zupa', title: 'Zupa pomidorowa' }])
    await expect(render('zupa')).resolves.toBe('page')
    expect(notFound).not.toHaveBeenCalled()
  })
})
