import { describe, it, expect, vi } from 'vitest'
import { estimateOpenAiCost, recordApiUsage } from './api-usage'

const clientWith = (rpc: unknown) => ({ rpc }) as never

describe('estimateOpenAiCost', () => {
  it('prices a known model per million tokens', () => {
    expect(estimateOpenAiCost('gpt-5.4-mini', 1_000_000, 1_000_000)).toBeCloseTo(5.25)
    expect(estimateOpenAiCost('gpt-4o-mini', 2000, 500)).toBeCloseTo(0.0006)
  })
  it('is 0 for an unknown model or negative tokens', () => {
    expect(estimateOpenAiCost('mystery', 1000, 1000)).toBe(0)
    expect(estimateOpenAiCost('gpt-4o-mini', -5, -5)).toBe(0)
  })
})

describe('recordApiUsage', () => {
  it('sends one increment with tokens and estimated cost', () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    recordApiUsage(clientWith(rpc), { service: 'openai', model: 'gpt-5.4-mini', tokensIn: 1000, tokensOut: 200 })
    expect(rpc).toHaveBeenCalledWith('record_api_usage', expect.objectContaining({
      p_service: 'openai', p_model: 'gpt-5.4-mini', p_calls: 1, p_tokens_in: 1000, p_tokens_out: 200, p_failures: 0,
    }))
    expect(rpc.mock.calls[0][1].p_cost_usd).toBeGreaterThan(0)
  })

  it('counts a failure and no cost for services without tokens', () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    recordApiUsage(clientWith(rpc), { service: 'firecrawl', failed: true, tokensIn: Number.NaN })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_model: '', p_failures: 1, p_tokens_in: 0, p_cost_usd: 0 })
  })

  it('never throws: rpc error, rejection, sync throw, missing rpc', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => recordApiUsage(clientWith(vi.fn().mockResolvedValue({ error: { message: 'x' } })), { service: 'jina' })).not.toThrow()
    expect(() => recordApiUsage(clientWith(vi.fn().mockRejectedValue(new Error('down'))), { service: 'jina' })).not.toThrow()
    expect(() => recordApiUsage(clientWith(vi.fn(() => { throw new Error('sync') })), { service: 'jina' })).not.toThrow()
    expect(() => recordApiUsage({} as never, { service: 'jina' })).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
    expect(warn).toHaveBeenCalled()
  })
})
