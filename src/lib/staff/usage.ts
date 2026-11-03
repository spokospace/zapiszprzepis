import type { SupabaseClient } from '@supabase/supabase-js'
import { categoryLabel } from '@/lib/recipe-categories'
import { addDays, byDay, count, fillDays, type DayValue } from './series'

/** The windows the admin screen shows. */
export const USAGE_WINDOWS = [7, 30] as const

/** The widest window the read RPC accepts (it clamps to this). */
export const MAX_USAGE_DAYS = 366

export const FEATURE_EVENTS = ['timer_start', 'print', 'favorite_add'] as const
export type FeatureEvent = (typeof FEATURE_EVENTS)[number]

/** Polish names for the feature counters. */
export const FEATURE_LABELS: Record<FeatureEvent, string> = {
  timer_start: 'Uruchomienia minutnika',
  print: 'Wydruki przepisu',
  favorite_add: 'Dodania do ulubionych',
}

export interface UsageSummary {
  days: number
  since: string
  categories: { subject: string; views: number; recipes: number }[]
  recipes: { slug: string; title: string; views: number }[]
  /** Views of slugs that no longer match a public recipe (renamed, hidden, deleted). */
  orphanViews: number
  /** Always one entry per feature event, zero when nothing was counted. */
  features: Record<FeatureEvent, number>
  /** One entry per day of the window, oldest first; zero on days with nothing counted. */
  daily: { recipeViews: DayValue[]; categoryViews: DayValue[] }
}

/** The `admin_usage_summary` document, reduced to what the screen shows; null when it is not that document. */
export function mapUsageSummary(raw: unknown): UsageSummary | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.since !== 'string' || !Number.isInteger(Number(r.days))) return null
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []

  const features = Object.fromEntries(FEATURE_EVENTS.map((e) => [e, 0])) as Record<FeatureEvent, number>
  for (const f of list(r.features)) {
    if ((FEATURE_EVENTS as readonly unknown[]).includes(f.event)) features[f.event as FeatureEvent] = count(f.count)
  }

  const days = Number(r.days)
  const daily = list(r.daily)
  const until = addDays(r.since, days - 1) ?? ''
  const eventSeries = (event: string) =>
    fillDays(r.since as string, until, byDay(daily.filter((d) => d.event === event), (d) => count(d.count)))

  return {
    days,
    since: r.since,
    categories: list(r.categories)
      .filter((c) => typeof c.subject === 'string')
      .map((c) => ({ subject: c.subject as string, views: count(c.views), recipes: count(c.recipes) })),
    recipes: list(r.recipes)
      .filter((c) => typeof c.slug === 'string')
      .map((c) => ({ slug: c.slug as string, title: typeof c.title === 'string' ? c.title : (c.slug as string), views: count(c.views) })),
    orphanViews: count(r.orphan_views),
    features,
    daily: { recipeViews: eventSeries('recipe_view'), categoryViews: eventSeries('category_view') },
  }
}

/** True when nothing at all was counted in the window: collection is off or has just started. */
export function isEmptySummary(s: UsageSummary): boolean {
  return (
    s.categories.length === 0 &&
    s.recipes.length === 0 &&
    s.orphanViews === 0 &&
    FEATURE_EVENTS.every((e) => s.features[e] === 0)
  )
}

const number = new Intl.NumberFormat('pl-PL')

/** A count with thousands separators ("12 345"). */
export function formatCount(n: number): string {
  return number.format(n)
}

const day = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeZone: 'UTC' })

/** A `YYYY-MM-DD` day as text; the input itself when it is not a date. */
export function formatDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? value : day.format(d)
}

/**
 * One CSV cell. Semicolon-separated because Excel in a Polish locale splits on `;`.
 * A cell that starts like a formula gets a leading apostrophe: recipe titles come
 * from user-added recipes, and a spreadsheet must not run them.
 */
function csvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * The summary as a CSV file for a spreadsheet: one row per category, recipe and
 * feature counter, plus the views of recipes that no longer exist. Starts with a
 * BOM so Excel reads the Polish letters as UTF-8.
 */
export function usageSummaryCsv(s: UsageSummary): string {
  const rows: (string | number)[][] = [['sekcja', 'klucz', 'nazwa', 'liczba', 'przepisow_w_kategorii']]
  for (const c of s.categories) rows.push(['kategoria', c.subject, categoryLabel(c.subject), c.views, c.recipes])
  for (const r of s.recipes) rows.push(['przepis', r.slug, r.title, r.views, ''])
  for (const e of FEATURE_EVENTS) rows.push(['funkcja', e, FEATURE_LABELS[e], s.features[e], ''])
  rows.push(['inne', 'orphan_views', 'Odsłony przepisów, których już nie ma pod tym adresem', s.orphanViews, ''])
  return `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}

/** The download name: the window and its first day, e.g. `statystyki-30-dni-od-2026-10-04.csv`. */
export function usageCsvFilename(s: UsageSummary): string {
  const since = /^\d{4}-\d{2}-\d{2}$/.test(s.since) ? s.since : 'brak-daty'
  return `statystyki-${s.days}-dni-od-${since}.csv`
}

export async function loadUsageSummary(supabase: SupabaseClient, days: number): Promise<UsageSummary | null> {
  const { data, error } = await supabase.rpc('admin_usage_summary', { p_days: days })
  const summary = error ? null : mapUsageSummary(data)
  if (!summary) console.error('[staff] admin_usage_summary failed:', error?.message ?? 'unexpected result')
  return summary
}
