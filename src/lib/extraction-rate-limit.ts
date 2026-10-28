import 'server-only'
import { withinRateLimit } from './rate-limit'

/**
 * May this user start another recipe extraction now? Each run is paid (OpenAI,
 * Firecrawl), so the binding caps each account (5 per minute, wrangler.jsonc
 * `EXTRACTION_LIMIT`; Workers limiters only take 10 s or 60 s windows). Checked
 * by every entry point (add form, /share, „Odśwież”, „Ponów”) after the
 * full-access gate and before any `recipe_shares` write or `recipe/extract`
 * event (E02-S11-T04, audit D4).
 *
 * Fails open, like the Exa limiter: only full-access accounts get this far (that
 * gate fails closed), and a limiter outage should not stop everyone adding recipes.
 */
export function extractionAllowed(userId: string): Promise<boolean> {
  return withinRateLimit('EXTRACTION_LIMIT', userId)
}

/** Thrown by triggerRecipeExtraction over the cap; /share maps it to /dodaj?add_error=rate_limited. */
export const EXTRACTION_RATE_LIMITED = 'Extraction rate limited'
