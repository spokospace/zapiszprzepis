import { describe, it, expect, vi } from 'vitest'
import { formatCtr, formatPosition, loadSearchSummary, mapSearchSummary } from './search'

const doc = {
  days: 28,
  since: '2026-10-06',
  last_day: '2026-10-31',
  queries: [{ query: 'sernik', clicks: '12', impressions: 300, position: 4.2 }, { query: 5 }],
  pages: [
    { path: '/przepis/sernik', title: 'Sernik', clicks: 9, impressions: 100, position: 3 },
    { path: '/', title: null, clicks: 1, impressions: 0, position: null },
  ],
  daily: [
    { day: '2026-10-29', clicks: 4, impressions: '120' },
    { day: '2026-10-31', clicks: 1, impressions: 80 },
  ],
}

describe('mapSearchSummary', () => {
  it('shapes the RPC document', () => {
    expect(mapSearchSummary(doc)).toEqual({
      days: 28,
      since: '2026-10-06',
      lastDay: '2026-10-31',
      queries: [{ query: 'sernik', clicks: 12, impressions: 300, position: 4.2 }],
      pages: [
        { path: '/przepis/sernik', title: 'Sernik', clicks: 9, impressions: 100, position: 3 },
        { path: '/', title: null, clicks: 1, impressions: 0, position: null },
      ],
      daily: expect.objectContaining({}),
    })
  })

  it('fills the daily totals from the first to the last synced day, not into days without data', () => {
    const s = mapSearchSummary(doc)!
    expect(s.daily.clicks).toEqual([
      { day: '2026-10-29', value: 4 },
      { day: '2026-10-30', value: 0 },
      { day: '2026-10-31', value: 1 },
    ])
    expect(s.daily.impressions[0]).toEqual({ day: '2026-10-29', value: 120 })
    expect(mapSearchSummary({ ...doc, last_day: null })!.daily.clicks).toEqual([])
    expect(mapSearchSummary({ ...doc, daily: [] })!.daily.clicks).toEqual([])
  })

  it('treats a never-synced table as no last day, and rejects anything that is not the document', () => {
    expect(mapSearchSummary({ ...doc, last_day: null })?.lastDay).toBeNull()
    expect(mapSearchSummary(null)).toBeNull()
    expect(mapSearchSummary({ days: 7 })).toBeNull()
  })
})

describe('formatting', () => {
  it('shows CTR and position in Polish, with a dash when there is nothing to show', () => {
    expect(formatCtr({ clicks: 21, impressions: 500, position: 3.44 }).replace(/\s/g, '')).toBe('4,2%')
    expect(formatCtr({ clicks: 0, impressions: 0, position: null })).toBe('–')
    expect(formatPosition({ clicks: 0, impressions: 1, position: 3.44 })).toBe('3,4')
    expect(formatPosition({ clicks: 0, impressions: 0, position: null })).toBe('–')
  })
})

describe('loadSearchSummary', () => {
  it('asks for the window and returns the shaped summary', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: doc, error: null })
    const summary = await loadSearchSummary({ rpc } as never, 28)
    expect(rpc).toHaveBeenCalledWith('admin_search_summary', { p_days: 28 })
    expect(summary?.queries).toHaveLength(1)
  })

  it('returns null when the RPC fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await loadSearchSummary({ rpc } as never, 7)).toBeNull()
  })
})
