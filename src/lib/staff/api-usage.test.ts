import { describe, it, expect } from 'vitest'
import { mapApiUsage, formatUsd } from './api-usage'

describe('mapApiUsage', () => {
  it('rejects anything that is not the document', () => {
    expect(mapApiUsage(null)).toBeNull()
    expect(mapApiUsage({ days: 7 })).toBeNull()
  })

  it('gives every service zeros and a filled series when nothing was counted', () => {
    const s = mapApiUsage({ days: 3, since: '2026-11-02', totals: [], daily: [] })!
    expect(s.services.map((x) => x.service)).toEqual(['openai', 'firecrawl', 'jina'])
    expect(s.services[0]).toMatchObject({ calls: 0, costUsd: 0 })
    expect(s.services[0].dailyCalls.map((d) => d.day)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })

  it('sums models per service and fills days', () => {
    const s = mapApiUsage({
      days: 2, since: '2026-11-03',
      totals: [
        { service: 'openai', model: 'a', calls: 2, tokens_in: 100, tokens_out: 50, failures: 1, cost_usd: 0.5 },
        { service: 'openai', model: 'b', calls: 1, tokens_in: 10, tokens_out: 5, failures: 0, cost_usd: 0.25 },
      ],
      daily: [{ day: '2026-11-04', service: 'openai', calls: 3, tokens_in: 110, tokens_out: 55, failures: 1, cost_usd: 0.75 }],
    })!
    const openai = s.services[0]
    expect(openai).toMatchObject({ calls: 3, failures: 1, tokensIn: 110, tokensOut: 55, costUsd: 0.75 })
    expect(openai.dailyCalls).toEqual([{ day: '2026-11-03', value: 0 }, { day: '2026-11-04', value: 3 }])
    expect(openai.dailyTokens[1].value).toBe(165)
  })

  it('formats cost', () => {
    expect(formatUsd(0)).toBe('–')
    expect(formatUsd(0.0123)).toContain('0,0123')
  })
})
