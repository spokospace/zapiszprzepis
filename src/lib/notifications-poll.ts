import type { NotificationsResult } from '@/lib/notifications'

/** How often /powiadomienia re-reads the list while a recipe is still being written up. */
export const IN_PROGRESS_POLL_MS = 10_000
/** Polls before giving up (about 5 minutes); past that the "Odśwież" button stays. */
export const IN_PROGRESS_POLL_MAX = 30

/**
 * What to announce when an auto-refresh moved cards out of "W trakcie": the
 * screen reader hears that a recipe is ready (or failed) without the user
 * having to look for the card. Empty when nothing that was in progress moved.
 */
export function finishedMessage(prevInProgress: readonly number[], result: NotificationsResult): string {
  if (result.status !== 'ok' || prevInProgress.length === 0) return ''
  const ready = result.ready.filter((r) => prevInProgress.includes(r.id))
  const failed = result.problems.filter((p) => prevInProgress.includes(p.id))
  const parts: string[] = []
  if (ready.length === 1) parts.push(`Przepis gotowy: ${ready[0].title}.`)
  else if (ready.length > 1) parts.push(`Gotowe przepisy: ${ready.length}.`)
  if (failed.length > 0) parts.push('Nie udało się dodać przepisu. Szczegóły w sekcji „Wymaga uwagi”.')
  return parts.join(' ')
}
