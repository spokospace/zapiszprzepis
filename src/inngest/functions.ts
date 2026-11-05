import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { recordApiUsage } from '@/lib/api-usage'
import { revalidateRecipeCaches } from '@/lib/recipe-cache'
import {
  runExtractRecipe,
  storeCoverAndGallery,
  storeStepImages,
  type ExtractRecipeEvent,
} from './run-extract-recipe'

/** The slice of Inngest's `step` tool the job uses, so a test can drive it. */
interface JobStep {
  run<T>(id: string, fn: () => Promise<T> | T): Promise<unknown>
}

/**
 * The slugs of the recipes a run wrote, for their own cache tags. `0` is a share that
 * saved nothing. A failed read costs only freshness, so it logs and the cache TTL bounds it.
 */
async function writtenSlugs(supabase: SupabaseClient, ids: number[]): Promise<string[]> {
  const wanted = [...new Set(ids.filter((id) => id > 0))]
  if (wanted.length === 0) return []
  const { data, error } = await supabase.from('recipes').select('slug').in('id', wanted)
  if (error) {
    console.error('[extract-recipe] slug lookup failed:', error.message)
    return []
  }
  return (data ?? []).map((row: { slug: string }) => row.slug)
}

export async function extractRecipeJob({ event, step }: { event: { data: unknown }; step: JobStep }) {
  const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // Each step is a Worker invocation of its own, with its own subrequest and
  // time budget, and Inngest retries a failed step alone. One invocation for
  // all of it ran out after uploading a photo-heavy page's images, before the
  // row got their URLs — and each of the retries redid the LLM extraction.
  const { images, ...result } = (await step.run('extract', () => {
    // Inngest meters runs and steps, so count each attempt of the extract step (a
    // retry counts again). Inside the step, not the handler: the handler body runs
    // once per step of a run and would count the same run several times.
    recordApiUsage(supabase, { service: 'inngest', model: 'extract-recipe' })
    return runExtractRecipe(event.data as ExtractRecipeEvent, { fetch, supabase, deferImages: true })
  })) as Awaited<ReturnType<typeof runExtractRecipe>>
  // The recipe row is written (inserted, refreshed or gap-filled) and the share is
  // complete, so the cached public lists and recipe pages must show it now, not
  // after the TTL (#445). A share that only settled on a saved recipe wrote
  // nothing public; purging then costs one re-read. Its own step so a retry of a
  // later step does not repeat it, and inside the /api/inngest request so
  // revalidateTag has Next's context. Only these recipes are purged, not every page.
  const written = [result.recipeId, ...(images ?? []).map((job) => job.recipeId)]
  const revalidateWritten = async () => revalidateRecipeCaches(...(await writtenSlugs(supabase, written)))
  await step.run('revalidate-recipe-caches', revalidateWritten)
  if (images) {
    // One job per recipe the link saved (several dishes of one page, phase 2).
    for (const [i, job] of images.entries()) {
      await step.run(`archive-cover-gallery-${i}`, () => storeCoverAndGallery(supabase, job))
      await step.run(`archive-step-images-${i}`, () => storeStepImages(supabase, job))
    }
    // The archived cover and step photos replace the source URLs on the rows.
    await step.run('revalidate-recipe-caches-after-images', revalidateWritten)
  }
  return result
}

export const extractRecipe = inngest.createFunction(
  { id: 'extract-recipe', retries: 3, triggers: { event: 'recipe/extract' } },
  extractRecipeJob,
)
