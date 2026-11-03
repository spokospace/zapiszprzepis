// Helpers shared by the staff statistics readers (usage counters, Search Console):
// tolerant number parsing and per-day series for the admin charts.

/** A non-negative finite number from an RPC value; 0 for anything else. */
export const count = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export interface DayValue {
  day: string
  value: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

/** A `YYYY-MM-DD` day moved by `n` days; null when it is not a day. */
export function addDays(day: string, n: number): string | null {
  if (!DAY.test(day)) return null
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Every day from `from` to `to` inclusive, oldest first, with its value or 0. Empty when either is not a day. */
export function fillDays(from: string, to: string, values: Map<string, number>): DayValue[] {
  const out: DayValue[] = []
  if (!DAY.test(to)) return out
  for (let day = addDays(from, 0); day && day <= to; day = addDays(day, 1)) {
    out.push({ day, value: values.get(day) ?? 0 })
  }
  return out
}

/** `value(row)` by `row.day`, for RPC rows that are already one per day. */
export function byDay(rows: Record<string, unknown>[], value: (row: Record<string, unknown>) => number): Map<string, number> {
  return new Map(rows.filter((r) => typeof r.day === 'string').map((r) => [r.day as string, value(r)]))
}
