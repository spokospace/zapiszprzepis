import { sha256Hex } from './sha256'

// Shorter texts are too generic to call two posts one recipe.
const MIN_CHARS = 80

/**
 * SHA-256 (hex) of the author's text with everything but letters and digits
 * removed — links, hashtags, emoji, punctuation, spacing and casing — so a
 * repost that only re-tags or re-spaces the caption hashes the same. Null for
 * a text too short to identify a recipe.
 */
export async function fingerprintText(text: string): Promise<string | null> {
  const core = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
  if (core.length < MIN_CHARS) return null
  return sha256Hex(core)
}
