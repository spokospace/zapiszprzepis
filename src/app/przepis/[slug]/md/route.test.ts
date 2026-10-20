import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/public-recipe', () => ({ canonicalRecipeBySlug: vi.fn() }))
vi.mock('@/lib/site-url', () => ({ getSiteUrl: vi.fn(async () => 'https://zapiszprzepis.pl') }))

import { GET } from './route'
import { canonicalRecipeBySlug } from '@/lib/public-recipe'
import type { RecipeForMarkdown } from '@/lib/recipe-markdown'

const recipe: RecipeForMarkdown = {
  slug: 'sernik',
  title: 'Sernik',
  description: 'Pyszny sernik.',
  meta_description: null,
  ingredients: [{ name: 'twaróg', amount: '1', unit: 'kg' }],
  steps: ['Wymieszaj.', 'Piecz.'],
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: 60,
  servings: 8,
  source_type: 'web_blog',
  source_url: 'https://aniagotuje.pl/sernik',
  source_author: null,
  youtube_id: null,
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe('GET /przepis/[slug]/md', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns markdown with noindex + canonical headers', async () => {
    vi.mocked(canonicalRecipeBySlug).mockResolvedValue(recipe)
    const res = await GET(new Request('http://localhost/przepis/sernik.md'), params('sernik'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, follow')
    expect(res.headers.get('Link')).toBe('<https://zapiszprzepis.pl/przepis/sernik>; rel="canonical"')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600')
    expect(await res.text()).toContain('# Sernik')
  })

  it('404s when the slug resolves to no recipe', async () => {
    vi.mocked(canonicalRecipeBySlug).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/przepis/nope.md'), params('nope'))
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })
})
