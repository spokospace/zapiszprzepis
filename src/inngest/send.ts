import { getInngestSecondary, inngest } from './client'

export type RecipeExtractData = Record<string, unknown>

/**
 * Sends `recipe/extract` to the primary Inngest account. When the primary
 * refuses the event and a secondary account is configured, the same event goes
 * to the secondary instead. Throws only when no account accepted it, so callers
 * keep their existing "mark the share failed" handling.
 */
export async function sendRecipeExtract(data: RecipeExtractData): Promise<void> {
  try {
    await inngest.send({ name: 'recipe/extract', data })
  } catch (error) {
    const fallback = getInngestSecondary()
    if (!fallback) throw error
    console.error('[inngest] primary refused recipe/extract, trying secondary:', error)
    await fallback.send({ name: 'recipe/extract', data })
  }
}
