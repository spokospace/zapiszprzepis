// The per-page verdict of scripts/smoke-prod-assets.ts, which loads every page
// several times (see its header for why).

/**
 * The failure line for a page's attempts, or null when every one was a 200.
 * Status 0 is an unreachable URL (`get` never throws).
 */
export function attemptFailure(page: string, statuses: number[]): string | null {
  const failed = statuses.filter((status) => status !== 200)
  if (failed.length === 0) return null
  const counts = new Map<string, number>()
  for (const status of failed) {
    const label = status === 0 ? 'unreachable' : String(status)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const breakdown = [...counts].map(([label, n]) => `${label}×${n}`).join(', ')
  return `page ${page} → ${failed.length}/${statuses.length} attempts failed (${breakdown})`
}
