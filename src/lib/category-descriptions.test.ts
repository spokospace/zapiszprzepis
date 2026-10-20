import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

// Mock only the client boundary: a .from(...).select(...).eq(...).maybeSingle()
// chain whose terminal result each test configures.
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ from }),
}))

const { getCategoryDescription, fallbackCategoryDescription } = await import('./category-descriptions')

beforeEach(() => {
  vi.clearAllMocks()
  // The error/miss paths log; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Distinct categories per scenario so React cache() memoization (if active in
// the test runtime) never carries one case's result into another.
describe('getCategoryDescription', () => {
  it('returns the stored sentence on a hit', async () => {
    maybeSingle.mockResolvedValue({ data: { meta_description: 'Ciasta prosto z sieci.' }, error: null })
    expect(await getCategoryDescription('ciasta')).toBe('Ciasta prosto z sieci.')
    expect(from).toHaveBeenCalledWith('category_descriptions')
  })

  it('falls back to the template when the category has no row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getCategoryDescription('zupy')).toBe(fallbackCategoryDescription('zupy'))
  })

  it('falls back to the template on a read error (missing table / RLS)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } })
    expect(await getCategoryDescription('desery')).toBe(fallbackCategoryDescription('desery'))
  })

  it('falls back to the template when the client throws — never propagates', async () => {
    maybeSingle.mockRejectedValue(new Error('network down'))
    expect(await getCategoryDescription('napoje')).toBe(fallbackCategoryDescription('napoje'))
  })
})

describe('fallbackCategoryDescription', () => {
  it('is non-empty and ≤ 160 chars for every category', () => {
    for (const { value } of RECIPE_CATEGORIES) {
      const sentence = fallbackCategoryDescription(value)
      expect(sentence.length).toBeGreaterThan(0)
      expect(sentence.length).toBeLessThanOrEqual(160)
    }
  })

  it('carries the diacritic label, not the raw enum slug', () => {
    expect(fallbackCategoryDescription('salatki')).toBe('Przepisy z kategorii Sałatki w aplikacji Zapisz Przepis.')
  })
})
