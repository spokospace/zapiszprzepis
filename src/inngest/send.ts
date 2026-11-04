import { getInngestSecondary, inngest } from './client'

export type RecipeExtractData = Record<string, unknown>

/** Which Inngest account accepted a recipe/extract event. */
export type InngestAccount = 'primary' | 'secondary'

/**
 * Sends `recipe/extract` to the primary Inngest account. When the primary
 * refuses the event and a secondary account is configured, the same event goes
 * to the secondary instead. Returns the account that accepted it, so the caller
 * can record it on the share row — the throttle watchdog (#580 phase 3) looks
 * for pending shares that went to the primary. Throws only when no account
 * accepted it, so callers keep their existing "mark the share failed" handling.
 */
export async function sendRecipeExtract(data: RecipeExtractData): Promise<InngestAccount> {
  try {
    await inngest.send({ name: 'recipe/extract', data })
    return 'primary'
  } catch (error) {
    const fallback = getInngestSecondary()
    if (!fallback) throw error
    console.error('[inngest] primary refused recipe/extract, trying secondary:', error)
    await fallback.send({ name: 'recipe/extract', data })
    return 'secondary'
  }
}
