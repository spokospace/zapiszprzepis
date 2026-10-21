/**
 * „Przepis dnia” (ZMIANY_prototyp §5c): one recipe a day, the same for everyone,
 * picked deterministically from the candidate pool — no „wylosuj inny”, no cron.
 * The day of the year drives the index (× 7 so consecutive days jump across the
 * pool rather than stepping one along), and the year keeps it from repeating the
 * same cycle every January. The day is counted in Europe/Warsaw, so the choice
 * flips at Polish midnight — not at 00:00 UTC (which is 01:00 CET / 02:00 CEST
 * local). Everyone still sees the same pick on a given Polish calendar day.
 */

const warsawParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Civil year/month/day in Europe/Warsaw for an instant (handles the CET/CEST switch). */
function warsawDate(date: Date): { year: number; month: number; day: number } {
  const parts = warsawParts.formatToParts(date)
  const value = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

/** Day of the year (1 = Jan 1) from a civil year/month (1-based)/day. */
function dayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0)
  const today = Date.UTC(year, month - 1, day)
  return Math.floor((today - start) / 86_400_000)
}

export function dayOfYearWarsaw(date: Date): number {
  const { year, month, day } = warsawDate(date)
  return dayOfYear(year, month, day)
}

/** The candidate index for a given day; 0 when the pool is empty. */
export function dailyRecipeIndex(date: Date, count: number): number {
  if (count <= 0) return 0
  const { year, month, day } = warsawDate(date)
  const seed = dayOfYear(year, month, day) * 7 + year
  return ((seed % count) + count) % count
}
