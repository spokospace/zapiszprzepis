import type { SupabaseClient } from '@supabase/supabase-js'

/** The windows the admin screen shows. 28 days matches Search Console's own default. */
export const SEARCH_WINDOWS = [7, 28] as const

export interface SearchRow {
  clicks: number
  impressions: number
  /** Average Google position, impression-weighted; null when there were no impressions. */
  position: number | null
}

export interface SearchSummary {
  days: number
  since: string
  /** The newest day synced from Search Console; null before the first sync. */
  lastDay: string | null
  queries: (SearchRow & { query: string })[]
  pages: (SearchRow & { path: string; title: string | null })[]
}

const count = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const metrics = (r: Record<string, unknown>): SearchRow => ({
  clicks: count(r.clicks),
  impressions: count(r.impressions),
  // Number(null) is 0, so null needs its own check; undefined becomes NaN.
  position: r.position === null || !Number.isFinite(Number(r.position)) ? null : Number(r.position),
})

/** The `admin_search_summary` document, reduced to what the screen shows; null when it is not that document. */
export function mapSearchSummary(raw: unknown): SearchSummary | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.since !== 'string' || !Number.isInteger(Number(r.days))) return null
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []

  return {
    days: Number(r.days),
    since: r.since,
    lastDay: typeof r.last_day === 'string' ? r.last_day : null,
    queries: list(r.queries)
      .filter((q) => typeof q.query === 'string')
      .map((q) => ({ query: q.query as string, ...metrics(q) })),
    pages: list(r.pages)
      .filter((p) => typeof p.path === 'string')
      .map((p) => ({ path: p.path as string, title: typeof p.title === 'string' ? p.title : null, ...metrics(p) })),
  }
}

const percent = new Intl.NumberFormat('pl-PL', { style: 'percent', maximumFractionDigits: 1 })

/** Click-through rate as Polish text ("4,2%"); a dash when there were no impressions. */
export function formatCtr(row: SearchRow): string {
  return row.impressions > 0 ? percent.format(row.clicks / row.impressions) : '–'
}

const decimal = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 })

/** Average position as Polish text ("3,4"); a dash when unknown. */
export function formatPosition(row: SearchRow): string {
  return row.position === null ? '–' : decimal.format(row.position)
}

export async function loadSearchSummary(supabase: SupabaseClient, days: number): Promise<SearchSummary | null> {
  const { data, error } = await supabase.rpc('admin_search_summary', { p_days: days })
  const summary = error ? null : mapSearchSummary(data)
  if (!summary) console.error('[staff] admin_search_summary failed:', error?.message ?? 'unexpected result')
  return summary
}
