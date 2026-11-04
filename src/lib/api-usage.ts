import type { SupabaseClient } from '@supabase/supabase-js'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// Usage counter for the external APIs the extraction depends on (OpenAI, Firecrawl,
// Jina). One atomic RPC increment per call into api_usage_daily; read by the admin
// page /admin/uzycie-api. Monitoring only: nothing here may fail or slow an extraction.

export type ApiService = 'openai' | 'firecrawl' | 'jina' | 'inngest'

/** USD per 1M tokens, [input, output]. Estimates: a model missing here costs 0 and is still counted. */
const OPENAI_PRICES: Record<string, readonly [number, number]> = {
  'gpt-5.4-mini': [0.75, 4.5],
  'gpt-5.4': [2.5, 15],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4o-mini': [0.15, 0.6],
}

/** Estimated USD for one OpenAI call; 0 for an unknown model. */
export function estimateOpenAiCost(model: string, tokensIn: number, tokensOut: number): number {
  const price = OPENAI_PRICES[model]
  if (!price) return 0
  return (Math.max(tokensIn, 0) * price[0] + Math.max(tokensOut, 0) * price[1]) / 1_000_000
}

export interface ApiUsageEntry {
  service: ApiService
  model?: string
  /** Tokens as the provider reported them (OpenAI `usage`). */
  tokensIn?: number
  tokensOut?: number
  failed?: boolean
}

const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0)

/**
 * Counts one API call. Fire-and-forget: returns at once, never throws, never retries.
 * A write failure is logged and dropped; on the Workers runtime the write is handed to
 * waitUntil so it survives the response.
 */
export function recordApiUsage(supabase: SupabaseClient, entry: ApiUsageEntry): void {
  try {
    const model = entry.model ?? ''
    const tokensIn = int(entry.tokensIn)
    const tokensOut = int(entry.tokensOut)
    const write = Promise.resolve(
      supabase.rpc('record_api_usage', {
        p_service: entry.service,
        p_model: model,
        p_calls: 1,
        p_tokens_in: tokensIn,
        p_tokens_out: tokensOut,
        p_failures: entry.failed ? 1 : 0,
        p_cost_usd: entry.service === 'openai' ? estimateOpenAiCost(model, tokensIn, tokensOut) : 0,
      }),
    )
      .then(({ error }) => {
        if (error) console.warn('[api-usage] write failed:', error.message)
      })
      .catch((err) => console.warn('[api-usage] write failed:', err))
    try {
      getCloudflareContext().ctx.waitUntil(write)
    } catch {
      // Not on the Worker (tests, local scripts): the promise just runs.
    }
  } catch (err) {
    console.warn('[api-usage] write failed:', err)
  }
}
