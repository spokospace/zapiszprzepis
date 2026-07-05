import { createClient } from '@supabase/supabase-js'
import { inngest } from './client'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { runExtractRecipe, type ExtractRecipeEvent } from './run-extract-recipe'

export const extractRecipe = inngest.createFunction(
  { id: 'extract-recipe', retries: 3, triggers: { event: 'recipe/extract' } },
  async ({ event }) => {
    const supabase = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return runExtractRecipe(event.data as ExtractRecipeEvent, { fetch, supabase })
  }
)
