// Remaining-plan snapshots from the providers that publish one. Used by the daily Worker
// cron (worker-cron.ts), so nothing here may import Next-specific code.
//
// Only Firecrawl exposes a balance a plain API key can read. OpenAI's costs endpoint needs
// an organization admin key, Jina has no balance endpoint, and Inngest's REST API has no
// plan-usage route; those services are covered by our own counter (api_usage_daily).

import type { Fetch } from './search-console'

export interface LimitSnapshot {
  service: string
  remaining: number
  total: number
  unit: string
  /** ISO end of the billing period, when the provider says so. */
  period_end: string | null
}

const FIRECRAWL_CREDIT_USAGE = 'https://api.firecrawl.dev/v2/team/credit-usage'

const nonNegative = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null

const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Credits left on the Firecrawl team plan. Throws with a short reason when the answer is unusable. */
export async function fetchFirecrawlLimit(apiKey: string, fetchFn: Fetch = fetch): Promise<LimitSnapshot> {
  const res = await fetchFn(FIRECRAWL_CREDIT_USAGE, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Firecrawl credit usage responded ${res.status}`)
  const data = ((await res.json()) as { data?: Record<string, unknown> } | null)?.data
  const remaining = nonNegative(data?.remainingCredits)
  const total = nonNegative(data?.planCredits)
  if (remaining === null || total === null) throw new Error('Firecrawl credit usage had an unexpected shape')
  return { service: 'firecrawl', remaining, total, unit: 'kredytów', period_end: isoOrNull(data?.billingPeriodEnd) }
}

/** Fraction of the plan already used, 0-1; null when the plan size is unknown. */
export function usedShare(remaining: number, total: number): number | null {
  if (!(total > 0)) return null
  return Math.min(1, Math.max(0, (total - remaining) / total))
}

/** `warn` from 80 % used, `critical` from 95 %. Pinned by tests because the page colours depend on it. */
export function limitLevel(remaining: number, total: number): 'ok' | 'warn' | 'critical' {
  const used = usedShare(remaining, total)
  if (used === null) return 'ok'
  if (used >= 0.95) return 'critical'
  if (used >= 0.8) return 'warn'
  return 'ok'
}
