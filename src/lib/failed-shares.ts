import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type FailedShare = {
  id: number
  shared_url: string
  error_message: string | null
}

/**
 * `error` means the bell could not check: it must say so rather than show a
 * confident zero, which would hide failed shares exactly when it matters.
 */
export type FailedSharesResult = { status: 'ok'; shares: FailedShare[] } | { status: 'error' }

/** A guest has no shares and no bell (E01-S02); used instead of querying for one. */
export const NO_FAILED_SHARES: FailedSharesResult = { status: 'ok', shares: [] }

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
 * RLS scopes the recipe_shares query to the current user. The recipes lookup is
 * also scoped by `userId` explicitly, as defense in depth: if recipes ever became
 * readable across users again, ANOTHER user's recipe for the same URL would
 * auto-resolve (hide) this user's failed share. The common case (no failures) costs a single small
 * indexed query — the recipes lookup runs only when there are failed rows, and
 * is bounded to their URLs.
 */
export async function getFailedShares(supabase: ServerClient, userId: string): Promise<FailedSharesResult> {
  const { data: failed, error: failedError } = await supabase
    .from('recipe_shares')
    .select('id, shared_url, error_message')
    .eq('status', 'failed')
    .is('recipe_id', null)
    .order('created_at', { ascending: false })

  if (failedError) {
    // Don't let a query failure render an empty bell — that would silently hide
    // failed shares, the exact NFR this feature upholds.
    console.error('[failed-shares] Failed to load failed shares:', failedError)
    return { status: 'error' }
  }
  if (!failed || failed.length === 0) return { status: 'ok', shares: [] }

  const failedUrls = [...new Set(failed.map((s) => s.shared_url))]
  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('source_url')
    .eq('user_id', userId)
    .in('source_url', failedUrls)

  // Without the lookup nothing can be auto-resolved: list every failed share
  // (over-reporting is the safe direction) instead of guessing.
  if (recipesError) {
    console.error('[failed-shares] Failed to auto-resolve failed shares:', recipesError)
  }

  const savedUrls = new Set(
    (recipes ?? []).map((r) => r.source_url).filter((u): u is string => Boolean(u)),
  )

  const seen = new Set<string>()
  const shares = failed.filter((s) => {
    if (savedUrls.has(s.shared_url)) return false
    if (seen.has(s.shared_url)) return false
    seen.add(s.shared_url)
    return true
  })
  return { status: 'ok', shares }
}
