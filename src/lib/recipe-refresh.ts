// The "Odśwież przepis" queue step, shared by the server action and the
// refresh script: one pending share plus one forced `recipe/extract` event.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecipeExtractData } from '@/inngest/send'
import { detectSourceType } from './detect-source-type'

/**
 * Queues a forced re-extraction of `sourceUrl` for `userId`. Returns the share
 * id, or null when no share row could be made. A share whose event never
 * queued is failed, not left pending to block re-adding its link (#382).
 */
export async function queueRecipeRefresh(
  supabase: SupabaseClient,
  sendExtract: (data: RecipeExtractData) => Promise<unknown>,
  { userId, sourceUrl }: { userId: string; sourceUrl: string },
): Promise<number | null> {
  const { data: share } = await supabase
    .from('recipe_shares')
    .insert({ user_id: userId, shared_url: sourceUrl, share_intent: { url: sourceUrl }, status: 'pending', attempts: 0 })
    .select()
    .single()
  if (!share) return null
  try {
    await sendExtract({ shareId: share.id, sharedUrl: sourceUrl, sourceType: detectSourceType(sourceUrl), userId, force: true })
  } catch (error) {
    console.error('[refresh] Failed to trigger re-extraction:', error)
    await supabase
      .from('recipe_shares')
      .update({ status: 'failed', error_message: 'Failed to queue extraction' })
      .eq('id', share.id)
  }
  return share.id
}
