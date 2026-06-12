type RecipeSource = 'facebook_text' | 'web_blog' | 'youtube'

interface FirecrawlScrapeOptions {
  url: string
  formats: string[]
  onlyMainContent: boolean
  actions?: Array<{ type: string; milliseconds: number }>
  excludeTags?: string[]
}

// Selectors matching common noise on blog/CMS pages — sidebar widgets,
// popular-posts blocks, comments, nav, archive lists, ads. Removed by
// Firecrawl before serializing markdown/html.
const BLOG_EXCLUDE_TAGS = [
  'nav',
  'aside',
  'footer',
  'header',
  '.widget',
  '.sidebar',
  '.comments',
  '#comments',
  '.share-buttons',
  '.related-posts',
  '.popular-posts',
  '.adsbygoogle',
  'iframe',
]

export function buildFirecrawlOptions(
  url: string,
  sourceType: RecipeSource,
  { fullContent = false }: { fullContent?: boolean } = {},
): FirecrawlScrapeOptions {
  // Default: onlyMainContent: true gives clean recipe-only markdown for
  // well-structured sites (e.g. mecooks). For classic blog templates
  // (blogspot, some WordPress themes) the heuristic over-strips and we
  // retry with fullContent: true + excludeTags so the LLM never sees
  // sidebar/widget/comments noise.
  const base: FirecrawlScrapeOptions = {
    url,
    formats: ['markdown', 'html'],
    onlyMainContent: !fullContent,
  }
  if (sourceType === 'web_blog') {
    return {
      ...base,
      actions: [{ type: 'wait', milliseconds: 2000 }],
      ...(fullContent ? { excludeTags: BLOG_EXCLUDE_TAGS } : {}),
    }
  }
  // YouTube watch pages render the description client-side; give the player a
  // moment to hydrate. No excludeTags — we want the full description, which is
  // where cooking channels usually paste the recipe (best-effort for S-04).
  if (sourceType === 'youtube') {
    return {
      ...base,
      actions: [{ type: 'wait', milliseconds: 2000 }],
    }
  }
  return base
}
