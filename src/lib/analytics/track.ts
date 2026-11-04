import type { UsageEvent } from '@/lib/analytics/events'

const ENDPOINT = '/api/e'

/**
 * Cookieless usage counter beacon (phase 2 of the first-party analytics spec). Sends exactly
 * `{e, s}`: no identifier, no cookie, no storage, no dedupe. Off unless the flag is "1", and
 * silent for visitors who signal "do not track" (GPC / DNT) and for automated browsers.
 */
export function track(event: UsageEvent, subject: string): void {
  if (process.env.NEXT_PUBLIC_USAGE_ANALYTICS !== '1') return
  if (typeof navigator === 'undefined') return
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.webdriver === true) return

  const body = JSON.stringify({ e: event, s: subject })
  try {
    // text/plain keeps the beacon a CORS-safelisted request (no preflight).
    if (typeof nav.sendBeacon === 'function' && nav.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, credentials: 'omit' }).catch(() => {})
  } catch {
    // Counting must never break the page.
  }
}
