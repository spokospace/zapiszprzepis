import type { SupabaseClient } from '@supabase/supabase-js'
import { hasAuthCookie } from '@/lib/auth-cookie'
import { getFailedShares, type FailedSharesResult } from '@/lib/failed-shares'
import { getMenuSummary, type MenuSummary } from '@/lib/menu-summary'

/**
 * Who is reading, as the browser knows it. `unknown` is the server render and the first
 * paint: the page must look the same for everyone until the session is read. The private
 * fields arrive after the user id; they are undefined while they load.
 */
export type BrowserSession =
  | { status: 'unknown' }
  | { status: 'guest' }
  | { status: 'user'; userId: string; menu?: MenuSummary | null; failedShares?: FailedSharesResult }

const UNKNOWN: BrowserSession = { status: 'unknown' }
const GUEST: BrowserSession = { status: 'guest' }
const CHECK_FAILED: FailedSharesResult = { status: 'error' }
/** How long the counters stay fresh between pages; an action that changes them forces a reload. */
const REFRESH_MS = 15_000

/**
 * Whether an auth error leaves the session undecided: no answer, 429 or a 5xx. The rule of
 * `isTransientAuthError`, by status: its module would put supabase-js in every guest's bundle.
 */
function isUndecided(error: { status?: number } | null): boolean {
  if (!error) return false
  return error.status === undefined || error.status === 429 || error.status >= 500
}

/**
 * The session and the header's private data, read straight from Supabase under RLS, so
 * none of it costs the Worker. The session is re-read on every sync, because signing in
 * or out happens on the server and tells the browser nothing. A guest has no session
 * cookie, so never downloads the Supabase client.
 */
export function createSessionStore(
  getClient: () => Promise<SupabaseClient>,
  hasSessionCookie: () => boolean,
  now: () => number = Date.now,
) {
  let session = UNKNOWN
  let loadedAt = 0
  // Only the newest load may write: an older one can belong to the previous user.
  let latestLoad = 0
  const listeners = new Set<() => void>()

  function publish(next: BrowserSession) {
    session = next
    for (const listener of listeners) listener()
  }

  function clear() {
    latestLoad++
    loadedAt = 0
    if (session !== GUEST) publish(GUEST)
  }

  async function sync({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (!hasSessionCookie()) return clear()
    const started = latestLoad
    const supabase = await getClient().catch(() => null)
    // A chunk gone after a deploy cannot be fetched again from this page, so the header
    // falls back to the guest variant; /login sends a signed-in reader back, and the next
    // page reads the session.
    if (!supabase) {
      if (session === UNKNOWN) publish(GUEST)
      return
    }
    const { data, error } = await supabase.auth.getSession()
    // A sign-out or a newer load overtook this read.
    if (started !== latestLoad) return
    // A refresh that could not reach Supabase is not a sign-out; a rejected token is.
    if (isUndecided(error) && session.status === 'user') return
    const userId = data.session?.user.id
    if (!userId) return clear()

    const sameUser = session.status === 'user' && session.userId === userId
    if (sameUser && !force && now() - loadedAt < REFRESH_MS) return
    if (!sameUser) publish({ status: 'user', userId })

    const load = ++latestLoad
    loadedAt = now()
    const [menu, failedShares] = await Promise.all([
      getMenuSummary(supabase, { id: userId }).catch(() => undefined),
      getFailedShares(supabase, userId).catch(() => CHECK_FAILED),
    ])
    if (load === latestLoad) publish({ status: 'user', userId, menu, failedShares })
  }

  return {
    sync,
    clear,
    getSnapshot: () => session,
    getServerSnapshot: () => UNKNOWN,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

export const browserSession = createSessionStore(
  async () => (await import('@/lib/supabase/client')).createSupabaseBrowserClient(),
  () => hasAuthCookie(document.cookie),
)
