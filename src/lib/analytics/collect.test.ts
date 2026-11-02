import { describe, it, expect, vi } from 'vitest'
import { collectUsageEvent, type CollectDeps } from './collect'

function deps(over: Partial<CollectDeps> = {}) {
  const record = vi.fn().mockResolvedValue(undefined)
  const defer = vi.fn()
  const withinLimit = vi.fn().mockResolvedValue(true)
  return { record, defer, withinLimit, deps: { enabled: true, withinLimit, record, defer, ...over } satisfies CollectDeps }
}

function beacon(text: string, headers: Record<string, string> = {}) {
  return new Request('https://zapiszprzepis.pl/api/e', { method: 'POST', body: text, headers })
}

const ok = JSON.stringify({ e: 'recipe_view', s: 'sernik' })

describe('collectUsageEvent', () => {
  it('records an allowlisted event and answers 204 with no body', async () => {
    const t = deps()
    const res = await collectUsageEvent(beacon(ok), t.deps)
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(t.record).toHaveBeenCalledWith('recipe_view', 'sernik')
    expect(t.defer).toHaveBeenCalledTimes(1)
  })

  it('does nothing while the flag is off (not even reading the limiter)', async () => {
    const t = deps({ enabled: false })
    const res = await collectUsageEvent(beacon(ok, { 'cf-connecting-ip': '1.2.3.4' }), t.deps)
    expect(res.status).toBe(204)
    expect(t.record).not.toHaveBeenCalled()
    expect(t.withinLimit).not.toHaveBeenCalled()
  })

  it('answers 400 to an oversized body and to non-JSON, without writing', async () => {
    const t = deps()
    expect((await collectUsageEvent(beacon('x'.repeat(300)), t.deps)).status).toBe(400)
    expect((await collectUsageEvent(beacon('not json'), t.deps)).status).toBe(400)
    expect(t.record).not.toHaveBeenCalled()
  })

  it('silently drops well-formed JSON that is not an allowlisted event', async () => {
    const t = deps()
    const res = await collectUsageEvent(beacon(JSON.stringify({ e: 'ingredient_check', s: 'sernik' })), t.deps)
    expect(res.status).toBe(204)
    expect(t.record).not.toHaveBeenCalled()
  })

  it('drops bot user agents', async () => {
    const t = deps()
    const res = await collectUsageEvent(beacon(ok, { 'user-agent': 'Googlebot/2.1' }), t.deps)
    expect(res.status).toBe(204)
    expect(t.record).not.toHaveBeenCalled()
  })

  it('keys the limiter by client address and drops over-limit events', async () => {
    const t = deps({ withinLimit: vi.fn().mockResolvedValue(false) })
    const res = await collectUsageEvent(beacon(ok, { 'cf-connecting-ip': '1.2.3.4' }), t.deps)
    expect(t.deps.withinLimit).toHaveBeenCalledWith('1.2.3.4')
    expect(res.status).toBe(204)
    expect(t.record).not.toHaveBeenCalled()
  })

  it('never reads cookies or stores the address: record gets only event and subject', async () => {
    const t = deps()
    await collectUsageEvent(
      beacon(ok, { cookie: 'sb-access-token=secret', 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'Mozilla/5.0' }),
      t.deps,
    )
    expect(t.record.mock.calls[0]).toEqual(['recipe_view', 'sernik'])
  })
})
