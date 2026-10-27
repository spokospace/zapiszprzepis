import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import {
  runExtractRecipe,
  storeCoverAndGallery,
  storeStepImages,
  type ExtractRecipeEvent,
  type RecipeImageJob,
} from './run-extract-recipe'

/** The slice of Inngest's `step` tool the job uses, so a test can drive it. */
interface JobStep {
  run<T>(id: string, fn: () => Promise<T> | T): Promise<unknown>
}

export async function extractRecipeJob({ event, step }: { event: { data: unknown }; step: JobStep }) {
  const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // Each step is a Worker invocation of its own, with its own subrequest and
  // time budget, and Inngest retries a failed step alone. One invocation for
  // all of it ran out after uploading a photo-heavy page's images, before the
  // row got their URLs — and each of the retries redid the LLM extraction.
  const { images, ...result } = (await step.run('extract', () =>
    runExtractRecipe(event.data as ExtractRecipeEvent, { fetch, supabase, deferImages: true }),
  )) as Awaited<ReturnType<typeof runExtractRecipe>>
  // The recipe row is written (inserted, refreshed or gap-filled) and the share is
  // complete, so the cached public lists and recipe pages must show it now, not
  // after the 120 s TTL (#445). A share that only settled on a saved recipe wrote
  // nothing public; purging then costs one re-read. Its own step so a retry of a
  // later step does not repeat it, and inside the /api/inngest request so
  // revalidateTag has Next's context.
  await step.run('revalidate-recipe-caches', () => revalidateRecipeCaches())
  if (images) {
    const job = images as RecipeImageJob
    await step.run('archive-cover-gallery', () => storeCoverAndGallery(supabase, job))
    await step.run('archive-step-images', () => storeStepImages(supabase, job))
    // The archived cover and step photos replace the source URLs on the row.
    await step.run('revalidate-recipe-caches-after-images', () => revalidateRecipeCaches())
  }
  return result
}

export const extractRecipe = inngest.createFunction(
  { id: 'extract-recipe', retries: 3, triggers: { event: 'recipe/extract' } },
  extractRecipeJob,
)
