// Screen Wake Lock controller for cooking mode (E01-S08).
//
// Framework-free so the re-acquire rules are unit-tested with a fake navigator
// and document. The browser drops a screen lock whenever the page is hidden, so
// while the lock is wanted it is requested again on every `visibilitychange` to
// visible. Every call is best effort: no API, a rejection (battery saver,
// permissions policy, insecure origin) or a hidden page resolves to `false` and
// never throws — cooking mode works without the lock.

/** The slice of WakeLockSentinel the controller uses. */
export interface SentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockEnv {
  navigator: { wakeLock?: { request(type: 'screen'): Promise<SentinelLike> } }
  document: {
    visibilityState: string
    addEventListener(type: 'visibilitychange', listener: () => void): void
    removeEventListener(type: 'visibilitychange', listener: () => void): void
  }
}

export interface ScreenWakeLock {
  readonly isSupported: boolean
  /** Want the lock: request it now (when visible) and again after every return to the tab. Resolves to whether it is held. */
  acquire(): Promise<boolean>
  /** Stop wanting the lock: release it and stop listening. Idempotent. */
  release(): Promise<void>
}

export function createScreenWakeLock(env: WakeLockEnv): ScreenWakeLock {
  const api = env.navigator.wakeLock
  let wanted = false
  let sentinel: SentinelLike | null = null
  let pending: Promise<boolean> | null = null

  async function request(): Promise<boolean> {
    if (!api || !wanted) return false
    if (sentinel && !sentinel.released) return true
    // A request while hidden always rejects; the next visibilitychange retries.
    if (env.document.visibilityState !== 'visible') return false
    if (pending) return pending
    pending = (async () => {
      try {
        const next = await api.request('screen')
        if (!wanted) {
          // release() ran while the request was in flight.
          await next.release().catch(() => {})
          return false
        }
        sentinel = next
        // The system can drop the lock on its own; forget it so `visible` re-takes it.
        next.addEventListener('release', () => {
          if (sentinel === next) sentinel = null
        })
        return true
      } catch {
        return false
      } finally {
        pending = null
      }
    })()
    return pending
  }

  const onVisibility = () => {
    if (env.document.visibilityState === 'visible') void request()
  }

  return {
    isSupported: Boolean(api),
    async acquire() {
      if (!api) return false
      if (!wanted) {
        wanted = true
        env.document.addEventListener('visibilitychange', onVisibility)
      }
      return request()
    },
    async release() {
      if (!wanted) return
      wanted = false
      env.document.removeEventListener('visibilitychange', onVisibility)
      const held = sentinel
      sentinel = null
      if (held && !held.released) await held.release().catch(() => {})
    },
  }
}
