// Detect scraped content that has no extractable recipe — a Google Translate
// interstitial ("Rate this translation…"), a bare "skip to main content" stub,
// or near-empty output. Firecrawl intermittently returns these for some
// templates. We use this to fail fast (so Inngest retries — the junk is usually
// transient) instead of feeding garbage to the LLM, which would either error or
// hallucinate a recipe.

const JUNK_SIGNATURES = [
  'rate this translation',
  'improve google translate',
  'przejdź do głównej zawartości',
  'skip to main content',
]

// Minimum readable characters a real recipe page yields. Real recipes carry
// ingredients + steps and clear this easily; the junk cases are all well under.
const MIN_CONTENT_CHARS = 150

/**
 * True when the content (markdown or HTML) carries no usable recipe text:
 * too short, or short-ish and dominated by a known junk signature.
 */
export function looksUnextractable(content: string): boolean {
  const clean = (content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < MIN_CONTENT_CHARS) return true
  const lower = clean.toLowerCase()
  return clean.length < 500 && JUNK_SIGNATURES.some((sig) => lower.includes(sig))
}
