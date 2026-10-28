import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/env', () => ({ getExaApiKey: vi.fn().mockReturnValue('test-key') }))
vi.mock('@/lib/exa-rate-limit', () => ({ exaSearchAllowed: vi.fn() }))
vi.mock('@/lib/recipe-dedup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/recipe-dedup')>()),
  findRecipeBySourceUrl: vi.fn().mockResolvedValue(null),
  findPublicRecipeBySourceUrl: vi.fn().mockResolvedValue(null),
}))

import { requireUser } from '@/lib/supabase/server'
import { exaSearchAllowed } from '@/lib/exa-rate-limit'
import { findPublicRecipeBySourceUrl, findRecipeBySourceUrl } from '@/lib/recipe-dedup'
import { searchViaExa } from './search-via-exa-action'

describe('searchViaExa — per-account cap', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ supabase: {}, user: { id: 'user-1' } } as any)
  })

  it('refuses over the cap before the paid Exa call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.mocked(exaSearchAllowed).mockResolvedValue(false)

    expect(await searchViaExa('tiramisu')).toEqual({ error: 'rate_limited' })
    expect(exaSearchAllowed).toHaveBeenCalledWith('user-1')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('searches for a signed-in account without full access', async () => {
    vi.mocked(exaSearchAllowed).mockResolvedValue(true)
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    expect(await searchViaExa('tiramisu')).toEqual({ results: [] })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

describe('searchViaExa — links already in the app (E01-S30)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ supabase: {}, user: { id: 'user-1' } } as any)
    vi.mocked(exaSearchAllowed).mockResolvedValue(true)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { url: 'https://www.mine.pl/dynia/', title: 'Moja' },
            { url: 'https://other.pl/dynia', title: 'Cudza' },
            { url: 'https://new.pl/dynia', title: 'Nowa' },
          ],
        }),
        { status: 200 },
      ),
    )
  })

  it('marks the own recipe, anyone else’s recipe and a new link — checked on the normalized key', async () => {
    vi.mocked(findRecipeBySourceUrl).mockImplementation(async (_s, userId, key) =>
      userId === 'user-1' && key === 'https://www.mine.pl/dynia' ? ({ slug: 'moja-dynia' } as any) : null,
    )
    vi.mocked(findPublicRecipeBySourceUrl).mockImplementation(async (_s, key) =>
      key === 'https://other.pl/dynia' ? { id: 7, slug: 'cudza-dynia' } : null,
    )

    const res = await searchViaExa('dynia')
    expect('results' in res && res.results.map((r) => r.existing)).toEqual([
      { owner: 'own', slug: 'moja-dynia' },
      { owner: 'other', slug: 'cudza-dynia' },
      null,
    ])
  })

  it('still lists a result whose lookup failed, without the hint', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(findRecipeBySourceUrl).mockRejectedValue(new Error('db down'))

    const res = await searchViaExa('dynia')
    expect('results' in res && res.results.map((r) => [r.title, r.existing])).toEqual([
      ['Moja', null],
      ['Cudza', null],
      ['Nowa', null],
    ])
  })
})

describe('searchViaExa — query length', () => {
  it('cuts a very long query before the paid Exa call', async () => {
    vi.restoreAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ supabase: {}, user: { id: 'user-1' } } as any)
    vi.mocked(exaSearchAllowed).mockResolvedValue(true)
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    await searchViaExa('a'.repeat(5000))
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(body.query).toHaveLength(200)
  })
})
