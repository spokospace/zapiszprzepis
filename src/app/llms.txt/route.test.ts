import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/site-url', () => ({ getSiteUrl: vi.fn(async () => 'https://zapiszprzepis.pl') }))
vi.mock('@/lib/public-recipe', () => ({ listCanonicalRecipes: vi.fn() }))

import { GET } from './route'
import { listCanonicalRecipes } from '@/lib/public-recipe'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

describe('GET /llms.txt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the index: H1, summary, categories and recipes (newest first, titled)', async () => {
    vi.mocked(listCanonicalRecipes).mockResolvedValue([
      { slug: 'stary', lastModified: '2026-01-01T00:00:00Z', title: 'Stary przepis' },
      { slug: 'nowy', lastModified: '2026-05-01T00:00:00Z', title: 'Nowy przepis' },
    ])
    const res = await GET()
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    const body = await res.text()
    expect(body.startsWith('# Zapisz Przepis\n')).toBe(true)
    expect(body).toContain('> Katalog przepisów')
    expect(body).toContain('## Kategorie')
    expect(body).toContain('## Przepisy')
    // Every category links its .md.
    for (const c of RECIPE_CATEGORIES) {
      expect(body).toContain(`](https://zapiszprzepis.pl/przepisy/${c.value}.md)`)
    }
    // Recipes use titles and are newest-first (nowy before stary).
    expect(body).toContain('- [Nowy przepis](https://zapiszprzepis.pl/przepis/nowy.md)')
    expect(body).toContain('- [Stary przepis](https://zapiszprzepis.pl/przepis/stary.md)')
    expect(body.indexOf('/przepis/nowy.md')).toBeLessThan(body.indexOf('/przepis/stary.md'))
  })

  it('still serves the categories section when the recipe read fails', async () => {
    vi.mocked(listCanonicalRecipes).mockRejectedValue(new Error('db down'))
    const body = await (await GET()).text()
    expect(body).toContain('## Kategorie')
    expect(body).not.toContain('## Przepisy')
  })
})
