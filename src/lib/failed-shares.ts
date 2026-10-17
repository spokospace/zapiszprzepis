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
 * Which of `urls` are the source of a recipe in the user's favorites — a link
 * someone else added first lands there instead of in "Moje przepisy"
 * (E01-S03a). Those recipes are usually other people's, which owner-only RLS
 * hides in `recipes`, so their source comes from public_recipes. A failed
 * lookup resolves nothing: over-reporting is the safe direction.
 */
async function favoritedSourceUrls(supabase: ServerClient, userId: string, urls: string[]): Promise<Set<string>> {
  const { data: favorites, error } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId)
  if (error) {
    console.error('[failed-shares] Failed to load favorites:', error)
    return new Set()
  }
  if (!favorites || favorites.length === 0) return new Set()

  const { data: recipes, error: recipesError } = await supabase
    .from('public_recipes')
    .select('source_url')
    .in('id', favorites.map((f) => f.recipe_id))
    .in('source_url', urls)
  if (recipesError) {
    console.error('[failed-shares] Failed to resolve favorited links:', recipesError)
    return new Set()
  }
  return new Set((recipes ?? []).map((r) => r.source_url).filter((u): u is string => Boolean(u)))
}

/**
 * Which of `urls` the user has added again and is still being processed
 * (E01-S15): the link is "W trakcie", so an older failed row for it must not
 * keep claiming a problem. A failed lookup resolves nothing (over-report).
 */
async function pendingSourceUrls(supabase: ServerClient, userId: string, urls: string[]): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('recipe_shares')
    .select('shared_url')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .in('shared_url', urls)
  if (error) {
    console.error('[failed-shares] Failed to load pending shares:', error)
    return new Set()
  }
  return new Set((data ?? []).map((s) => s.shared_url))
}

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
 *  - Re-added: a URL with a newer `pending` row is in progress, not a problem
 *    (E01-S15), so the bell, the home banner and /powiadomienia agree.
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
  const [{ data: recipes, error: recipesError }, favoritedUrls, pendingUrls] = await Promise.all([
    supabase.from('recipes').select('source_url').eq('user_id', userId).in('source_url', failedUrls),
    favoritedSourceUrls(supabase, userId, failedUrls),
    pendingSourceUrls(supabase, userId, failedUrls),
  ])

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
    if (savedUrls.has(s.shared_url) || favoritedUrls.has(s.shared_url) || pendingUrls.has(s.shared_url)) return false
    if (seen.has(s.shared_url)) return false
    seen.add(s.shared_url)
    return true
  })
  return { status: 'ok', shares }
}
