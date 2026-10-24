import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import {
  runExtractRecipe,
  storeCoverAndGallery,
  storeStepImages,
  type ExtractRecipeEvent,
  type RecipeImageJob,
} from './run-extract-recipe'

export const extractRecipe = inngest.createFunction(
  { id: 'extract-recipe', retries: 3, triggers: { event: 'recipe/extract' } },
  async ({ event, step }) => {
    const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    // Each step is a Worker invocation of its own, with its own subrequest and
    // time budget, and Inngest retries a failed step alone. One invocation for
    // all of it ran out after uploading a photo-heavy page's images, before the
    // row got their URLs — and each of the retries redid the LLM extraction.
    const { images, ...result } = await step.run('extract', () =>
      runExtractRecipe(event.data as ExtractRecipeEvent, { fetch, supabase, deferImages: true }),
    )
    if (images) {
      const job = images as RecipeImageJob
      await step.run('archive-cover-gallery', () => storeCoverAndGallery(supabase, job))
      await step.run('archive-step-images', () => storeStepImages(supabase, job))
    }
    return result
  },
)
