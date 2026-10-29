import 'server-only'
import { withinRateLimit } from './rate-limit'

/**
 * May this user run another Exa web search now? Exa is paid and, since the
 * search fallback opened to every signed-in account, the binding caps each
 * account (5 per minute, wrangler.jsonc `EXA_SEARCH_LIMIT`). Fails open.
 */
export function exaSearchAllowed(userId: string): Promise<boolean> {
  return withinRateLimit('EXA_SEARCH_LIMIT', userId)
}
