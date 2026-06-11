type RecipeSource = 'facebook_text' | 'web_blog'

interface FirecrawlScrapeOptions {
  url: string
  formats: string[]
  onlyMainContent: boolean
  actions?: Array<{ type: string; milliseconds: number }>
}

export function buildFirecrawlOptions(url: string, sourceType: RecipeSource): FirecrawlScrapeOptions {
  // Blogspot, WordPress and other classic blog templates trip Firecrawl's
  // main-content heuristic — it sometimes strips everything except the
  // "skip to main content" link. Keep the full body and let the LLM
  // ignore navigation, sidebars and comments.
  if (sourceType === 'web_blog') {
    return {
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: false,
      actions: [{ type: 'wait', milliseconds: 2000 }],
    }
  }
  return { url, formats: ['markdown', 'html'], onlyMainContent: true }
}
