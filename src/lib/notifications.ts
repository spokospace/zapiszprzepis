import 'server-only'
import type { createSupabaseServerClient } from '@/lib/supabase/server'
import { getFailedShares } from '@/lib/failed-shares'
import { explainShareError, shareDomain } from '@/lib/share-error'

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export type ProblemItem = { id: number; url: string; domain: string; reason: string }
/** `slow`: pending longer than SLOW_AFTER_MS — the card says it is taking longer than usual. */
export type InProgressItem = { id: number; url: string; domain: string; since: string; slow: boolean }
export type DoneItem = { id: number; url: string; domain: string; slug: string; title: string; at: string }

/** `error` means the page could not check — it must say so, never show "Wszystko gotowe" (#137). */
export type NotificationsResult =
  | { status: 'ok'; problems: ProblemItem[]; inProgress: InProgressItem[]; done: DoneItem[] }
  | { status: 'error' }

/** How far back "Wcześniej" reaches, and how many cards it shows (E01-S15, A4). */
export const DONE_WINDOW_DAYS = 14
const DONE_LIMIT = 10
const IN_PROGRESS_LIMIT = 20

/** A pending share older than this gets the "dłużej niż zwykle" copy. */
const SLOW_AFTER_MS = 15 * 60 * 1000

/**
 * The /powiadomienia feed (E01-S15): "Wymaga uwagi" (failed), "W trakcie"
 * (pending) and "Wcześniej" (completed in the last 14 days). Problems come
 * from getFailedShares, so the page, the bell badge and the home banner use
 * one rule. Only this page pays for the two extra queries; every other page
 * keeps the single failed-shares lookup (#226).
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
  const since = new Date(now.getTime() - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [failed, pending, completed] = await Promise.all([
    getFailedShares(supabase, userId),
    supabase
      .from('recipe_shares')
      .select('id, shared_url, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(IN_PROGRESS_LIMIT),
    supabase
      .from('recipe_shares')
      .select('id, shared_url, recipe_id, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('recipe_id', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(DONE_LIMIT * 2),
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
  }))

  const pendingSeen = new Set<string>()
  const inProgress: InProgressItem[] = []
  for (const s of pending.data ?? []) {
    if (pendingSeen.has(s.shared_url)) continue
    pendingSeen.add(s.shared_url)
    inProgress.push({
      id: s.id,
      url: s.shared_url,
      domain: shareDomain(s.shared_url),
      since: s.created_at,
      slow: now.getTime() - Date.parse(s.created_at) > SLOW_AFTER_MS,
    })
  }

  return { status: 'ok', problems, inProgress, done: await doneItems(supabase, completed.data ?? []) }
}

type CompletedRow = { id: number; shared_url: string; recipe_id: number | null; created_at: string }

/**
 * Completed shares → "Gotowe" cards, one per recipe. A recipe that is gone
 * (deleted, merged away) is skipped rather than linked dead. A failed title
 * lookup drops the section instead of failing the page.
 */
async function doneItems(supabase: ServerClient, rows: CompletedRow[]): Promise<DoneItem[]> {
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
      return [{ id: r.id, url: r.shared_url, domain: shareDomain(r.shared_url), slug: recipe.slug, title: recipe.title, at: r.created_at }]
    })
    .slice(0, DONE_LIMIT)
}
