import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/** The Workers rate-limiting binding (`ratelimits` in wrangler.jsonc). */
type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> }

/**
 * May this user run another Exa web search now? Exa is paid and, since the
 * search fallback opened to every signed-in account, the binding caps each
 * account (5 per minute, wrangler.jsonc `EXA_SEARCH_LIMIT`). Fails open: under
 * `next dev` there is no Workers runtime, and a broken limiter should cost a
 * few searches, not the feature.
 */
export async function exaSearchAllowed(userId: string): Promise<boolean> {
  let limiter: RateLimiter | undefined
  try {
    limiter = (getCloudflareContext().env as unknown as { EXA_SEARCH_LIMIT?: RateLimiter }).EXA_SEARCH_LIMIT
  } catch {
    return true
  }
  if (!limiter) return true
  try {
    return (await limiter.limit({ key: userId })).success
  } catch (err) {
    console.error('[exa-rate-limit] limiter failed', err)
    return true
  }
}
