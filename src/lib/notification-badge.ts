import type { FailedSharesResult } from '@/lib/failed-shares'

/**
 * What the "Powiadomienia" badge shows (E01-S15): problems + ready recipes not
 * opened yet. `loadFailed` means the check itself failed, so the badge says so
 * instead of a confident zero (#137). Shared by the desktop bell and, below lg,
 * the MENU button and its drawer row (#323).
 */
export type NotificationBadge = { count: number; loadFailed: boolean }

export function notificationBadge(result: FailedSharesResult): NotificationBadge {
  return result.status === 'ok'
    ? { count: result.shares.length + result.unreadReady, loadFailed: false }
    : { count: 0, loadFailed: true }
}

/** "1 powiadomienie", "3 powiadomienia", "5 powiadomień", "22 powiadomienia", "12 powiadomień". */
export function notificationsNoun(count: number): string {
  if (count === 1) return 'powiadomienie'
  const lastDigit = count % 10
  const lastTwo = count % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'powiadomienia'
  return 'powiadomień'
}
