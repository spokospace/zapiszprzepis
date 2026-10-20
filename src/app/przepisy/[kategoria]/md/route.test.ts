import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/site-url', () => ({ getSiteUrl: vi.fn(async () => 'https://zapiszprzepis.pl') }))
vi.mock('@/lib/public-recipe', () => ({ listCanonicalRecipesByCategory: vi.fn() }))

import { GET } from './route'
import { listCanonicalRecipesByCategory } from '@/lib/public-recipe'

const params = (kategoria: string) => ({ params: Promise.resolve({ kategoria }) })

describe('GET /przepisy/[kategoria]/md', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the category markdown, newest-first, each recipe linking its .md', async () => {
    // Shared reader returns oldest-first; the handler reverses for display.
    vi.mocked(listCanonicalRecipesByCategory).mockResolvedValue([
      { slug: 'szarlotka', lastModified: '2026-01-01T00:00:00Z', title: 'Szarlotka' },
      { slug: 'sernik', lastModified: '2026-03-01T00:00:00Z', title: 'Sernik' },
    ])
    const res = await GET(new Request('http://localhost/przepisy/ciasta.md'), params('ciasta'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, follow')
    expect(res.headers.get('Link')).toBe('<https://zapiszprzepis.pl/przepisy/ciasta>; rel="canonical"')
    const body = await res.text()
    expect(body).toContain('# Przepisy: Ciasta')
    expect(body).toContain('- [Sernik](https://zapiszprzepis.pl/przepis/sernik.md)')
    expect(body).toContain('- [Szarlotka](https://zapiszprzepis.pl/przepis/szarlotka.md)')
    // Newest-first: sernik (reversed to front) before szarlotka.
    expect(body.indexOf('/przepis/sernik.md')).toBeLessThan(body.indexOf('/przepis/szarlotka.md'))
  })

  it('404s for an unknown category without hitting the DB', async () => {
    const res = await GET(new Request('http://localhost/przepisy/nope.md'), params('nope'))
    expect(res.status).toBe(404)
    expect(listCanonicalRecipesByCategory).not.toHaveBeenCalled()
  })
})
