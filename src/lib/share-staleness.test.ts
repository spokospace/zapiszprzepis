import { describe, it, expect } from 'vitest'
import { isStalePending, stalePendingCutoff, STALE_PENDING_MS } from './share-staleness'

const NOW = new Date('2026-10-21T12:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000).toISOString()

describe('isStalePending (#382)', () => {
  it('is stale once a pending share has not been updated for more than 15 minutes', () => {
    expect(isStalePending({ status: 'pending', updated_at: ago(16) }, NOW)).toBe(true)
  })

  it('is not stale while the share is recent (negative case: 2 minutes)', () => {
    expect(isStalePending({ status: 'pending', updated_at: ago(2) }, NOW)).toBe(false)
    expect(isStalePending({ status: 'pending', updated_at: ago(15) }, NOW)).toBe(false)
  })

  it('only ever applies to pending shares, and never to an unknown time', () => {
    expect(isStalePending({ status: 'failed', updated_at: ago(60) }, NOW)).toBe(false)
    expect(isStalePending({ status: 'completed', updated_at: ago(60) }, NOW)).toBe(false)
    expect(isStalePending({ status: 'pending', updated_at: null }, NOW)).toBe(false)
    expect(isStalePending({ status: 'pending', updated_at: 'not a date' }, NOW)).toBe(false)
  })
})

describe('stalePendingCutoff', () => {
  it('is STALE_PENDING_MS before now', () => {
    expect(Date.parse(stalePendingCutoff(NOW))).toBe(NOW.getTime() - STALE_PENDING_MS)
  })
})
