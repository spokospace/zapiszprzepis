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

const { getCategoryDescription, fallbackCategoryDescription, getCategoryTitle, getCategoryMeta, fallbackCategoryTitle } =
  await import('./category-descriptions')

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

// Distinct categories from the description cases above so React cache() never
// carries one result into another (the loaders share one cached read).
describe('getCategoryTitle', () => {
  it('returns the stored title base on a hit', async () => {
    maybeSingle.mockResolvedValue({ data: { meta_title: 'Obiady jak u mamy' }, error: null })
    expect(await getCategoryTitle('obiady')).toBe('Obiady jak u mamy')
  })

  it('falls back to the curated title when the category has no stored title', async () => {
    maybeSingle.mockResolvedValue({ data: { meta_description: 'x' }, error: null })
    expect(await getCategoryTitle('sniadania')).toBe(fallbackCategoryTitle('sniadania'))
  })

  it('falls back to the curated title on a read error — never propagates', async () => {
    maybeSingle.mockRejectedValue(new Error('network down'))
    expect(await getCategoryTitle('pieczywo')).toBe(fallbackCategoryTitle('pieczywo'))
  })
})

describe('getCategoryMeta', () => {
  it('returns both the stored title and description in one read', async () => {
    maybeSingle.mockResolvedValue({
      data: { meta_title: 'Przekąski na imprezę', meta_description: 'Małe co nieco.' },
      error: null,
    })
    expect(await getCategoryMeta('przekaski')).toEqual({ title: 'Przekąski na imprezę', description: 'Małe co nieco.' })
    expect(from).toHaveBeenCalledWith('category_descriptions')
  })
})

describe('fallbackCategoryTitle', () => {
  it('is non-empty and ≤ 70 chars for every category', () => {
    for (const { value } of RECIPE_CATEGORIES) {
      const title = fallbackCategoryTitle(value)
      expect(title.length).toBeGreaterThan(0)
      expect(title.length).toBeLessThanOrEqual(70)
    }
  })

  it('is a tailored phrase, not the bare label', () => {
    for (const { value, label } of RECIPE_CATEGORIES) {
      expect(fallbackCategoryTitle(value)).not.toBe(label)
    }
  })
})
