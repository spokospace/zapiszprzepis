import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/site-url', () => ({ getSiteUrl: vi.fn(async () => 'https://zapiszprzepis.pl') }))
vi.mock('@/lib/public-recipe', () => ({
  listCanonicalRecipes: vi.fn(),
  listPublicProfileUsernames: vi.fn(),
}))

import sitemap from './sitemap'
import { listCanonicalRecipes, listPublicProfileUsernames } from '@/lib/public-recipe'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'
import { LEGAL_PATHS } from '@/lib/routes'

const urls = (entries: Awaited<ReturnType<typeof sitemap>>) => entries.map((e) => e.url)

describe('sitemap.xml', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists home, categories, legal, search, recipes and profiles', async () => {
    vi.mocked(listCanonicalRecipes).mockResolvedValue([
      { slug: 'sernik', lastModified: '2026-06-01T00:00:00Z' },
      { slug: 'piernik', lastModified: '2026-03-01T00:00:00Z' },
    ])
    vi.mocked(listPublicProfileUsernames).mockResolvedValue(['ania', 'marek'])

    const entries = await sitemap()
    const all = urls(entries)

    expect(all).toContain('https://zapiszprzepis.pl/')
    expect(all).toContain('https://zapiszprzepis.pl/szukaj')
    expect(all).toContain('https://zapiszprzepis.pl/przepis/sernik')
    expect(all).toContain('https://zapiszprzepis.pl/u/ania')
    for (const c of RECIPE_CATEGORIES) expect(all).toContain(`https://zapiszprzepis.pl/przepisy/${c.value}`)
    for (const p of LEGAL_PATHS) expect(all).toContain(`https://zapiszprzepis.pl${p}`)

    // 1 home + 1 search + 12 categories + 3 legal + 2 recipes + 2 profiles
    expect(entries).toHaveLength(2 + RECIPE_CATEGORIES.length + LEGAL_PATHS.length + 2 + 2)

    const sernik = entries.find((e) => e.url.endsWith('/przepis/sernik'))
    expect(sernik?.lastModified).toEqual(new Date('2026-06-01T00:00:00Z'))
  })

  it('falls back to the static set when the recipe read fails', async () => {
    vi.mocked(listCanonicalRecipes).mockRejectedValue(new Error('db down'))
    vi.mocked(listPublicProfileUsernames).mockResolvedValue([])

    const all = urls(await sitemap())
    expect(all).toContain('https://zapiszprzepis.pl/')
    expect(all.some((u) => u.includes('/przepis/'))).toBe(false)
    expect(all.some((u) => u.includes('/u/'))).toBe(false)
    // home + search + 12 categories + 3 legal
    expect(all).toHaveLength(2 + RECIPE_CATEGORIES.length + LEGAL_PATHS.length)
  })
})
