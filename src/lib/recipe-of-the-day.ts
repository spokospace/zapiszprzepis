/**
 * „Przepis dnia” (ZMIANY_prototyp §5c): one recipe a day, the same for everyone,
 * picked deterministically from the candidate pool — no „wylosuj inny”, no cron.
 * The day of the year drives the index (× 7 so consecutive days jump across the
 * pool rather than stepping one along), and the year keeps it from repeating the
 * same cycle every January. UTC so the choice flips at one instant for all viewers.
 */
export function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((today - start) / 86_400_000)
}

/** The candidate index for a given day; 0 when the pool is empty. */
export function dailyRecipeIndex(date: Date, count: number): number {
  if (count <= 0) return 0
  const seed = dayOfYearUTC(date) * 7 + date.getUTCFullYear()
  return ((seed % count) + count) % count
}
