import { createSupabaseServerClient } from '@/lib/supabase/server'

export type FailedShare = {
  id: number
  shared_url: string
  error_message: string | null
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * Failed extractions that never produced a recipe — surfaced in the header
 * notification bell so no shared URL is silently lost (NFR "żadne żądanie nie
 * ginie cicho"). Two cleanups keep the bell honest:
 *
 *  - Auto-resolve: a shared_url that already has a recipe (added via another
 *    share) is dropped, even though its old `failed` row lingers — this is the
 *    "wyświetla się cały czas, nawet jak przepisy się dodały" case. It is a
 *    plain string compare because both `recipe_shares.shared_url` and
 *    `recipes.source_url` are written pre-normalized by the dedup path
 *    (`normalizeUrl` / SQL `normalize_url()`); the match relies on that invariant.
 *  - Dedupe by URL: retries can leave several failed rows for one URL.
 *
 * RLS scopes every query to the current user. The common case (no failures)
 * costs a single small indexed query — the recipes lookup runs only when there
 * are failed rows, and is bounded to their URLs.
 */
export async function getFailedShares(supabase: ServerClient): Promise<FailedShare[]> {
  const { data: failed } = await supabase
    .from('recipe_shares')
    .select('id, shared_url, error_message')
    .eq('status', 'failed')
    .is('recipe_id', null)
    .order('created_at', { ascending: false })

  if (!failed || failed.length === 0) return []

  const failedUrls = [...new Set(failed.map((s) => s.shared_url))]
  const { data: recipes } = await supabase
    .from('recipes')
    .select('source_url')
    .in('source_url', failedUrls)

  const savedUrls = new Set(
    (recipes ?? []).map((r) => r.source_url).filter((u): u is string => Boolean(u)),
  )

  const seen = new Set<string>()
  return failed.filter((s) => {
    if (savedUrls.has(s.shared_url)) return false
    if (seen.has(s.shared_url)) return false
    seen.add(s.shared_url)
    return true
  })
}
