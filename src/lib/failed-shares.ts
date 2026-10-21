import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isStalePending, STALE_PENDING_ERROR } from '@/lib/share-staleness'

export type FailedShare = {
  id: number
  shared_url: string
  error_message: string | null
  created_at: string
}

/**
 * `error` means the bell could not check: it must say so rather than show a
 * confident zero, which would hide failed shares exactly when it matters.
 * `unreadReady` counts recipes saved but not opened yet from /powiadomienia
 * (E01-S15): the bell shows problems + unread ready recipes.
 */
export type FailedSharesResult = { status: 'ok'; shares: FailedShare[]; unreadReady: number } | { status: 'error' }

/** A guest has no shares and no bell (E01-S02); used instead of querying for one. */
export const NO_FAILED_SHARES: FailedSharesResult = { status: 'ok', shares: [], unreadReady: 0 }

/** How far back a ready recipe still counts and shows on /powiadomienia (E01-S15). */
export const READY_WINDOW_DAYS = 14

/** The start of the ready-recipe window, as an ISO timestamp. */
export function readyWindowStart(now: Date = new Date()): string {
  return new Date(now.getTime() - READY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

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
 * keep claiming a problem. A stale pending row (#382) is not in progress — it
 * is listed as a problem itself. A failed lookup resolves nothing (over-report).
 */
async function pendingSourceUrls(supabase: ServerClient, userId: string, urls: string[]): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('recipe_shares')
    .select('shared_url, status, updated_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .in('shared_url', urls)
  if (error) {
    console.error('[failed-shares] Failed to load pending shares:', error)
    return new Set()
  }
  const now = new Date()
  return new Set((data ?? []).filter((s) => !isStalePending(s, now)).map((s) => s.shared_url))
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
 *  - Stuck: a `pending` row past STALE_PENDING_MS stopped without a result
 *    (#382) and is listed as failed, so „Ponów” is offered for it.
 *
 * RLS scopes the recipe_shares query to the current user. The recipes lookup is
 * also scoped by `userId` explicitly, as defense in depth: if recipes ever became
 * readable across users again, ANOTHER user's recipe for the same URL would
 * auto-resolve (hide) this user's failed share. The common case (no failures) costs a single small
 * indexed query — the recipes lookup runs only when there are failed rows, and
 * is bounded to their URLs.
 */
export async function getFailedShares(supabase: ServerClient, userId: string): Promise<FailedSharesResult> {
  const [shares, unreadReady] = await Promise.all([
    loadFailedShares(supabase, userId),
    countUnreadReady(supabase, userId),
  ])
  return shares === null ? { status: 'error' } : { status: 'ok', shares, unreadReady }
}

/** Rows scanned for the unread count; far above what one user shares in 14 days. */
const UNREAD_SCAN_LIMIT = 100

/**
 * Ready recipes not opened yet (E01-S15), backed by the partial unread index.
 * Counted per recipe, as /powiadomienia shows them: a link shared twice (or a
 * share repointed by a merge) is one card, and opening it marks every share of
 * that recipe read, so the badge never keeps a number no card can clear. Only
 * `recipe_id` is fetched — a few ids at most. It must never break the bell —
 * before the read-state migration is applied (or on any error) it counts 0.
 */
async function countUnreadReady(supabase: ServerClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('recipe_shares')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('recipe_id', 'is', null)
    .is('read_at', null)
    .is('cleared_at', null)
    .gte('created_at', readyWindowStart())
    .limit(UNREAD_SCAN_LIMIT)
  if (error) {
    console.error('[failed-shares] Failed to count unread ready recipes:', error)
    return 0
  }
  return new Set((data ?? []).map((s) => s.recipe_id)).size
}

/** `null` = could not check. */
async function loadFailedShares(supabase: ServerClient, userId: string): Promise<FailedShare[] | null> {
  // Failed rows plus pending ones, so a stale pending share (#382) is caught.
  const { data: rows, error: failedError } = await supabase
    .from('recipe_shares')
    .select('id, shared_url, error_message, created_at, status, updated_at')
    .neq('status', 'completed')
    .is('recipe_id', null)
    .order('created_at', { ascending: false })

  if (failedError) {
    // Don't let a query failure render an empty bell — that would silently hide
    // failed shares, the exact NFR this feature upholds.
    console.error('[failed-shares] Failed to load failed shares:', failedError)
    return null
  }
  const now = new Date()
  const failed = (rows ?? []).flatMap((s) => {
    if (s.status === 'failed') return [s]
    return isStalePending(s, now) ? [{ ...s, error_message: STALE_PENDING_ERROR }] : []
  })
  if (failed.length === 0) return []

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
  return failed.filter((s) => {
    if (savedUrls.has(s.shared_url) || favoritedUrls.has(s.shared_url) || pendingUrls.has(s.shared_url)) return false
    if (seen.has(s.shared_url)) return false
    seen.add(s.shared_url)
    return true
  })
}
