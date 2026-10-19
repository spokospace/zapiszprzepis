import { describe, it, expect } from 'vitest'
import { notificationBadge, notificationsNoun } from './notification-badge'

describe('notificationBadge', () => {
  it('counts problems plus ready recipes not opened yet', () => {
    const shares = [{ id: 1, shared_url: 'https://a.pl', error_message: null, created_at: '2026-10-19T09:00:00Z' }]
    expect(notificationBadge({ status: 'ok', shares, unreadReady: 2 })).toEqual({ count: 3, loadFailed: false })
  })

  it('reports a failed check instead of a confident zero', () => {
    expect(notificationBadge({ status: 'error' })).toEqual({ count: 0, loadFailed: true })
  })
})

describe('notificationsNoun', () => {
  it.each([
    [1, 'powiadomienie'],
    [2, 'powiadomienia'],
    [4, 'powiadomienia'],
    [5, 'powiadomień'],
    [12, 'powiadomień'],
    [14, 'powiadomień'],
    [22, 'powiadomienia'],
    [25, 'powiadomień'],
  ])('%i → %s', (count, noun) => {
    expect(notificationsNoun(count)).toBe(noun)
  })
})
