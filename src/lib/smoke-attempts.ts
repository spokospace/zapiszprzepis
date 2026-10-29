// The per-page verdict of scripts/smoke-prod-assets.ts, which loads every page
// several times (see its header for why).

/**
 * One attempt's outcome, after the caller has retried a 1102 with backoff:
 *   - ok           a 200 (`recovered` when it took riding out a 1102 to get there)
 *   - cpu-limit    still a Cloudflare 1102 (Worker CPU limit) after the retries were spent
 *   - error        any other non-200: a non-1102 5xx, a 404, a redirect, or unreachable (status 0)
 */
export type AttemptResult =
  | { kind: 'ok'; recovered: boolean }
  | { kind: 'cpu-limit' }
  | { kind: 'error'; status: number }

export interface AttemptVerdict {
  /** A real fault — the page is not serving, or served something broken. Exits the check 1. Null when none. */
  hardFailure: string | null
  /** A transient post-deploy cold-start the retries rode out. Reported, never fails. Null when none. */
  transientNote: string | null
}

/**
 * Classify a page's attempts.
 *
 * A Cloudflare 1102 (the Worker exceeding its CPU limit) that RECOVERS on retry is the
 * transient post-deploy cold-start this check tolerates: a new release makes every
 * isolate cold at once, a cold SSR render can briefly exceed the free-tier per-request
 * CPU ceiling, and the isolate warms within the retry window. That is a note, not a
 * failure.
 *
 * Everything else is a hard failure the deploy gate must catch: a 1102 still failing
 * after the retries are spent (`cpu-limit`) is not a brief blip — it is the sustained
 * CPU-limit regression this check exists to catch (the 2026-10-22 incident served 503
 * to ~40% of requests); a non-1102 status is an outright fault; and a page that never
 * served a 200 is down. None of these warms away.
 */
export function classifyAttempts(page: string, results: AttemptResult[]): AttemptVerdict {
  const served = results.some((r) => r.kind === 'ok')
  const failed = results.filter((r) => r.kind !== 'ok')

  if (failed.length > 0) {
    const neverServed = served ? '' : '; the page never served a 200'
    return {
      hardFailure: `page ${page} → ${failed.length}/${results.length} attempts failed (${breakdown(results)})${neverServed}`,
      transientNote: null,
    }
  }

  // Every attempt served a 200. Note the ones that first hit a 1102 and recovered.
  const recovered = results.filter((r) => r.kind === 'ok' && r.recovered).length
  return {
    hardFailure: null,
    transientNote:
      recovered > 0
        ? `page ${page} → every attempt served 200; ${recovered}/${results.length} recovered from error 1102 after retry (post-deploy cold start, not an outage)`
        : null,
  }
}

/** A `1102×2, 500×1, unreachable×1` tally of the failed (non-200) attempts. */
function breakdown(results: AttemptResult[]): string {
  const counts = new Map<string, number>()
  for (const r of results) {
    if (r.kind === 'ok') continue
    const label = r.kind === 'cpu-limit' ? '1102' : r.status === 0 ? 'unreachable' : String(r.status)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, n]) => `${label}×${n}`).join(', ')
}
