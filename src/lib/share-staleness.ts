// A share stuck in `pending` (#382). There is no `processing` state and no
// sweeper: when an extraction run is killed, its share stays `pending` forever,
// blocks re-adding the link (`?duplicate=pending`) and hides „Ponów”. So a
// share still pending this long after its last update counts as failed on read.
// `updated_at` (bumped by trigger on every update), not `created_at`: „Ponów”
// puts an old share back to `pending`, and that retry is fresh.

export const STALE_PENDING_MS = 15 * 60 * 1000

/** What the bell and /powiadomienia say for a share that stopped without a result. */
export const STALE_PENDING_ERROR = 'Nie udało się dokończyć dodawania przepisu. Spróbuj ponownie.'

/** The `updated_at` before which a pending share is stale, as an ISO timestamp. */
export function stalePendingCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - STALE_PENDING_MS).toISOString()
}

/** True for a `pending` share last updated more than STALE_PENDING_MS ago. An unknown time is never stale. */
export function isStalePending(
  share: { status?: string | null; updated_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (share.status !== 'pending' || !share.updated_at) return false
  const updated = Date.parse(share.updated_at)
  return Number.isFinite(updated) && now.getTime() - updated > STALE_PENDING_MS
}
