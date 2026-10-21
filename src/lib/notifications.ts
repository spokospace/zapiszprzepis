import 'server-only'
import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { getFailedShares, readyWindowStart } from '@/lib/failed-shares'
import { explainShareError, shareDomain } from '@/lib/share-error'
import { isStalePending } from '@/lib/share-staleness'

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export type ProblemItem = { id: number; url: string; domain: string; reason: string; at: string }
/** `slow`: pending longer than SLOW_AFTER_MS — the card says it is taking longer than usual. */
export type InProgressItem = { id: number; url: string; domain: string; at: string; slow: boolean }
/** `read`: opened from /powiadomienia ("Wcześniej"); unread ones are "Nowe" and count on the bell. */
export type ReadyItem = { id: number; url: string; domain: string; slug: string; title: string; at: string; read: boolean }

/** `error` means the page could not check — it must say so, never show "Nie ma nowych powiadomień" (#137). */
export type NotificationsResult =
  | { status: 'ok'; problems: ProblemItem[]; inProgress: InProgressItem[]; ready: ReadyItem[] }
  | { status: 'error' }

const READY_LIMIT = 20
const IN_PROGRESS_LIMIT = 20
const SLOW_AFTER_MS = 15 * 60 * 1000

/**
 * The /powiadomienia feed (E01-S15, handoff §5): "Wymaga uwagi" (failed),
 * "W trakcie" (pending), "Nowe" / "Wcześniej" (completed in the last 14 days,
 * unread / read). Problems come from getFailedShares, so the page, the bell
 * badge and the home banner use one rule. Only this page pays for the two
 * extra queries (#226).
 *
 * RLS scopes recipe_shares to the user; `user_id` is filtered explicitly too
 * (defense in depth, as in failed-shares). Recipe titles come from
 * public_recipes because a link someone else added first lands in the user's
 * favorites, and that recipe row is not theirs (owner-only `recipes`).
 */
export async function getNotifications(
  supabase: ServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<NotificationsResult> {
  const [failed, pending, completed] = await Promise.all([
    getFailedShares(supabase, userId),
    supabase
      .from('recipe_shares')
      .select('id, shared_url, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(IN_PROGRESS_LIMIT),
    supabase
      .from('recipe_shares')
      .select('id, shared_url, recipe_id, created_at, read_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('recipe_id', 'is', null)
      .is('cleared_at', null)
      .gte('created_at', readyWindowStart(now))
      .order('created_at', { ascending: false })
      .limit(READY_LIMIT * 2),
  ])

  if (failed.status === 'error' || pending.error || completed.error) {
    if (pending.error) console.error('[notifications] Failed to load pending shares:', pending.error)
    if (completed.error) console.error('[notifications] Failed to load completed shares:', completed.error)
    return { status: 'error' }
  }

  const problems = failed.shares.map((s) => ({
    id: s.id,
    url: s.shared_url,
    domain: shareDomain(s.shared_url),
    reason: explainShareError(s.error_message),
    at: s.created_at,
  }))

  const pendingSeen = new Set<string>()
  const inProgress: InProgressItem[] = []
  for (const s of pending.data ?? []) {
    // A stale pending share (#382) is a problem, listed by getFailedShares.
    if (isStalePending({ status: 'pending', updated_at: s.updated_at }, now)) continue
    if (pendingSeen.has(s.shared_url)) continue
    pendingSeen.add(s.shared_url)
    inProgress.push({
      id: s.id,
      url: s.shared_url,
      domain: shareDomain(s.shared_url),
      at: s.created_at,
      slow: now.getTime() - Date.parse(s.created_at) > SLOW_AFTER_MS,
    })
  }

  return { status: 'ok', problems, inProgress, ready: await readyItems(supabase, completed.data ?? []) }
}

type CompletedRow = { id: number; shared_url: string; recipe_id: number | null; created_at: string; read_at: string | null }

/**
 * Completed shares → "Gotowe" cards, one per recipe (the newest share wins).
 * A recipe that is gone (deleted, merged away) is skipped rather than linked
 * dead. A failed title lookup drops the ready sections instead of the page.
 */
async function readyItems(supabase: ServerClient, rows: CompletedRow[]): Promise<ReadyItem[]> {
  const seen = new Set<number>()
  const unique = rows.filter((r): r is CompletedRow & { recipe_id: number } => {
    if (r.recipe_id == null || seen.has(r.recipe_id)) return false
    seen.add(r.recipe_id)
    return true
  })
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from('public_recipes')
    .select('id, slug, title')
    .in('id', unique.map((r) => r.recipe_id))
  if (error) {
    console.error('[notifications] Failed to load recipe titles:', error)
    return []
  }

  const recipes = new Map((data ?? []).map((r) => [r.id, r]))
  return unique
    .flatMap((r) => {
      const recipe = recipes.get(r.recipe_id)
      if (!recipe?.slug || !recipe.title) return []
      return [
        {
          id: r.id,
          url: r.shared_url,
          domain: shareDomain(r.shared_url),
          slug: recipe.slug,
          title: recipe.title,
          at: r.created_at,
          read: r.read_at != null,
        },
      ]
    })
    .slice(0, READY_LIMIT)
}
