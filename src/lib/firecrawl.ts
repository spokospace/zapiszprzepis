type RecipeSource = 'facebook_text' | 'web_blog'

interface FirecrawlScrapeOptions {
  url: string
  formats: string[]
  onlyMainContent: boolean
  actions?: Array<{ type: string; milliseconds: number }>
}

export function buildFirecrawlOptions(url: string, sourceType: RecipeSource): FirecrawlScrapeOptions {
  const base: FirecrawlScrapeOptions = { url, formats: ['markdown', 'html'], onlyMainContent: true }
  if (sourceType === 'web_blog') {
    return { ...base, actions: [{ type: 'wait', milliseconds: 2000 }] }
  }
  return base
}
