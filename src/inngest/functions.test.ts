import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }))
vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://db.example', getSuabaseServiceRoleKey: () => 'service-key' }))
vi.mock('@/lib/recipe-cache', () => ({ revalidateRecipeCaches: vi.fn() }))
vi.mock('./run-extract-recipe', () => ({
  runExtractRecipe: vi.fn(),
  storeCoverAndGallery: vi.fn(),
  storeStepImages: vi.fn(),
}))

import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import { extractRecipeJob } from './functions'
import { runExtractRecipe, storeCoverAndGallery, storeStepImages } from './run-extract-recipe'

/** Runs every step inline and records the step ids in order, like a first Inngest pass. */
function fakeStep() {
  const ids: string[] = []
  return {
    ids,
    run: async <T>(id: string, fn: () => Promise<T> | T) => {
      ids.push(id)
      return fn()
    },
  }
}

const EVENT = { data: { shareId: 1, sharedUrl: 'https://example.com/r', userId: 'user-1' } }
const RESULT = { recipeId: 7, title: 'Sernik', category: 'ciasta', status: 'created' }
const IMAGES = { recipeId: 7, userId: 'user-1', cover: 'https://example.com/c.jpg', gallery: [], stepSources: [], replace: false }

beforeEach(() => vi.clearAllMocks())

describe('extractRecipeJob — cache invalidation (#445)', () => {
  it('purges the recipe caches right after the extraction, then again after the photos are archived', async () => {
    vi.mocked(runExtractRecipe).mockResolvedValue({ ...RESULT, images: IMAGES })
    const step = fakeStep()

    const result = await extractRecipeJob({ event: EVENT, step })

    expect(step.ids).toEqual([
      'extract',
      'revalidate-recipe-caches',
      'archive-cover-gallery',
      'archive-step-images',
      'revalidate-recipe-caches-after-images',
    ])
    expect(revalidateRecipeCaches).toHaveBeenCalledTimes(2)
    expect(storeCoverAndGallery).toHaveBeenCalledWith(expect.anything(), IMAGES)
    expect(storeStepImages).toHaveBeenCalledWith(expect.anything(), IMAGES)
    expect(result).toEqual(RESULT)
  })

  it('purges once when the recipe has no photos to archive', async () => {
    vi.mocked(runExtractRecipe).mockResolvedValue(RESULT)
    const step = fakeStep()

    await extractRecipeJob({ event: EVENT, step })

    expect(step.ids).toEqual(['extract', 'revalidate-recipe-caches'])
    expect(revalidateRecipeCaches).toHaveBeenCalledTimes(1)
  })

  it('does not purge when the extraction fails (nothing was written)', async () => {
    vi.mocked(runExtractRecipe).mockRejectedValue(new Error('scrape failed'))
    const step = fakeStep()

    await expect(extractRecipeJob({ event: EVENT, step })).rejects.toThrow('scrape failed')

    expect(step.ids).toEqual(['extract'])
    expect(revalidateRecipeCaches).not.toHaveBeenCalled()
  })
})
