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

/**
 * Output-side gate (Risk 2): true only when the LLM actually returned a usable
 * recipe — a non-empty title AND a non-empty ingredients array AND a non-empty
 * steps array. The current pipeline only checks the title, so a page with no
 * recipe can be persisted as a titled, body-less recipe. Pure; wiring this into
 * the pipeline (reject-before-persist) is a later rollout phase.
 */
export function isExtractedRecipeUsable(recipe: {
  title?: unknown
  ingredients?: unknown
  steps?: unknown
}): boolean {
  const titleOk = typeof recipe.title === 'string' && recipe.title.trim().length > 0
  const ingredientsOk = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
  const stepsOk = Array.isArray(recipe.steps) && recipe.steps.length > 0
  return titleOk && ingredientsOk && stepsOk
}
