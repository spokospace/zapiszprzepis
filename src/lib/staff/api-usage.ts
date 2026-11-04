import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, byDay, count, fillDays, type DayValue } from './series'

/** The windows the admin screen shows. */
export const API_USAGE_WINDOWS = [7, 28] as const

export const API_SERVICES = ['openai', 'firecrawl', 'jina', 'inngest'] as const
export type ApiServiceName = (typeof API_SERVICES)[number]

export interface ApiUsageTotals {
  calls: number
  failures: number
  tokensIn: number
  tokensOut: number
  /** Estimated USD (OpenAI only). */
  costUsd: number
}

export interface ApiServiceUsage extends ApiUsageTotals {
  service: ApiServiceName
  models: (ApiUsageTotals & { model: string })[]
  /** One entry per day of the window, oldest first; zero on days with nothing counted. */
  dailyCalls: DayValue[]
  dailyTokens: DayValue[]
}

export interface ApiUsageSummary {
  days: number
  since: string
  services: ApiServiceUsage[]
}

const money = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const totals = (r: Record<string, unknown>): ApiUsageTotals => ({
  calls: count(r.calls),
  failures: count(r.failures),
  tokensIn: count(r.tokens_in),
  tokensOut: count(r.tokens_out),
  costUsd: money(r.cost_usd),
})

const sum = (rows: ApiUsageTotals[]): ApiUsageTotals => ({
  calls: rows.reduce((a, r) => a + r.calls, 0),
  failures: rows.reduce((a, r) => a + r.failures, 0),
  tokensIn: rows.reduce((a, r) => a + r.tokensIn, 0),
  tokensOut: rows.reduce((a, r) => a + r.tokensOut, 0),
  costUsd: rows.reduce((a, r) => a + r.costUsd, 0),
})

/** The `admin_api_usage` document, reduced to what the screen shows; null when it is not that document. */
export function mapApiUsage(raw: unknown): ApiUsageSummary | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.since !== 'string' || !Number.isInteger(Number(r.days))) return null
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []

  const days = Number(r.days)
  const totalRows = list(r.totals)
  const dailyRows = list(r.daily)
  const until = addDays(r.since, days - 1) ?? ''

  const services = API_SERVICES.map((service): ApiServiceUsage => {
    const models = totalRows
      .filter((t) => t.service === service)
      .map((t) => ({ model: typeof t.model === 'string' ? t.model : '', ...totals(t) }))
    const mine = dailyRows.filter((d) => d.service === service)
    const series = (value: (d: Record<string, unknown>) => number) => fillDays(r.since as string, until, byDay(mine, value))
    return {
      service,
      ...sum(models),
      models,
      dailyCalls: series((d) => count(d.calls)),
      dailyTokens: series((d) => count(d.tokens_in) + count(d.tokens_out)),
    }
  })
  return { days, since: r.since, services }
}

export async function loadApiUsage(supabase: SupabaseClient, days: number): Promise<ApiUsageSummary | null> {
  const { data, error } = await supabase.rpc('admin_api_usage', { p_days: days })
  const summary = error ? null : mapApiUsage(data)
  if (!summary) console.error('[staff] admin_api_usage failed:', error?.message ?? 'unexpected result')
  return summary
}

const usd = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })

/** Estimated cost as Polish text ("$0,0123"); a dash for services that are not billed per token. */
export function formatUsd(value: number): string {
  return value > 0 ? usd.format(value) : '–'
}

/** What a provider says is left of its plan, as of `fetchedAt`. */
export interface ApiLimit {
  service: string
  remaining: number
  total: number
  unit: string
  /** ISO end of the billing period, when the provider gave one. */
  periodEnd: string | null
  fetchedAt: string
}

/** The `admin_api_limits` document: rows with unusable numbers are dropped; null when it is not a list. */
export function mapApiLimits(raw: unknown): ApiLimit[] | null {
  if (!Array.isArray(raw)) return null
  const limits: ApiLimit[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const remaining = Number(r.remaining)
    const total = Number(r.total)
    if (typeof r.service !== 'string' || typeof r.fetched_at !== 'string') continue
    if (!Number.isFinite(remaining) || !Number.isFinite(total) || remaining < 0 || total < 0) continue
    limits.push({
      service: r.service,
      remaining,
      total,
      unit: typeof r.unit === 'string' ? r.unit : '',
      periodEnd: typeof r.period_end === 'string' ? r.period_end : null,
      fetchedAt: r.fetched_at,
    })
  }
  return limits
}

export async function loadApiLimits(supabase: SupabaseClient): Promise<ApiLimit[] | null> {
  const { data, error } = await supabase.rpc('admin_api_limits')
  const limits = error ? null : mapApiLimits(data)
  if (!limits) console.error('[staff] admin_api_limits failed:', error?.message ?? 'unexpected result')
  return limits
}
