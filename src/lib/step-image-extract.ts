// Per-step image extraction for the recipe importer (ZMIANA zdjęcia kroków).
//
// Two sources feed a step's photo, both kept honest:
//  1. the extraction LLM, which now returns steps as `{ text, image }` and picks
//     an in-content <img> for each step — accepted ONLY when that URL really is
//     in the fetched page (a model can't invent a link that isn't there), and
//  2. the page's schema.org `HowToStep.image` (deterministic), used at the same
//     position when the LLM gave none and the two step lists line up.
// The cover photo is never used as a step image.

/** Resolve a possibly-relative URL against the page; '' when it cannot. */
function absolutize(url: string, base: URL | undefined): string {
  try {
    return new URL(url, base).href
  } catch {
    return ''
  }
}

function safeBase(pageUrl?: string): URL | undefined {
  if (!pageUrl) return undefined
  try {
    return new URL(pageUrl)
  } catch {
    return undefined
  }
}

/**
 * The LLM may return `steps` as plain strings (old shape) or `{ text, image }`
 * objects (new shape). Split into index-aligned texts and image URLs (null when a
 * step has none), tolerating either shape and dropping entries without text.
 */
export function splitLlmSteps(raw: unknown): { steps: string[]; images: (string | null)[] } {
  if (!Array.isArray(raw)) return { steps: [], images: [] }
  const steps: string[] = []
  const images: (string | null)[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      steps.push(entry)
      images.push(null)
    } else if (entry && typeof entry === 'object') {
      const text = (entry as { text?: unknown }).text
      if (typeof text === 'string') {
        steps.push(text)
        const image = (entry as { image?: unknown }).image
        images.push(typeof image === 'string' && image.trim() ? image.trim() : null)
      }
    }
  }
  return { steps, images }
}

/**
 * The source image URL for each step (index-aligned with `steps`), or null. An
 * LLM pick is kept only when the exact URL appears in the fetched `html`; the
 * schema.org `howToImages` fill the gaps when they line up one-to-one with the
 * steps. The cover is excluded. Returned URLs are absolute, ready for archiving.
 */
export function buildStepImageSources({
  steps,
  llmImages,
  howToImages,
  html,
  pageUrl,
  coverUrl,
}: {
  steps: string[]
  llmImages: (string | null)[]
  /** From jsonLdHowToStepImages, in source step order (already absolute). */
  howToImages: string[]
  /** The full fetched page(s), for validating an LLM-picked URL is real. */
  html: string
  pageUrl?: string
  coverUrl?: string
}): (string | null)[] {
  const base = safeBase(pageUrl)
  const coverAbs = coverUrl ? absolutize(coverUrl, base) : ''
  const alignHowTo = howToImages.length === steps.length
  const notCover = (abs: string) => abs !== '' && abs !== coverAbs

  return steps.map((_, i) => {
    // 1) The LLM's pick, only if the exact URL is really in the page.
    const llm = llmImages[i]
    if (llm && html.includes(llm)) {
      const abs = absolutize(llm, base)
      if (notCover(abs)) return abs
    }
    // 2) The deterministic schema.org HowToStep image at the same position.
    if (alignHowTo && howToImages[i] && notCover(howToImages[i])) return howToImages[i]
    return null
  })
}
