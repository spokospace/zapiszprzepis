import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/** The Workers rate-limiting binding (`ratelimits` in wrangler.jsonc). */
type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> }

/** Bindings declared under `ratelimits` in wrangler.jsonc. */
export type RateLimitBinding = 'EXA_SEARCH_LIMIT' | 'EXTRACTION_LIMIT' | 'MCP_LIMIT'

/**
 * Is `key` still under the cap of the `binding` limiter? Fails open: under
 * `next dev` there is no Workers runtime, and a broken limiter should cost a
 * few paid calls, not the feature.
 */
export async function withinRateLimit(binding: RateLimitBinding, key: string): Promise<boolean> {
  let limiter: RateLimiter | undefined
  try {
    limiter = (getCloudflareContext().env as unknown as Partial<Record<RateLimitBinding, RateLimiter>>)[binding]
  } catch {
    return true
  }
  if (!limiter) return true
  try {
    return (await limiter.limit({ key })).success
  } catch (err) {
    console.error(`[rate-limit] ${binding} failed`, err)
    return true
  }
}
