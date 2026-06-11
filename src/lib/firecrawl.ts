type RecipeSource = 'facebook_text' | 'web_blog'

interface FirecrawlScrapeOptions {
  url: string
  formats: string[]
  onlyMainContent: boolean
  actions?: Array<{ type: string; milliseconds: number }>
}

export function buildFirecrawlOptions(
  url: string,
  sourceType: RecipeSource,
  { fullContent = false }: { fullContent?: boolean } = {},
): FirecrawlScrapeOptions {
  // Default: onlyMainContent: true gives clean recipe-only markdown for
  // well-structured sites (e.g. mecooks). For classic blog templates
  // (blogspot, some WordPress themes) the heuristic over-strips and we
  // retry with fullContent: true — the LLM ignores nav/sidebar via prompt.
  const base: FirecrawlScrapeOptions = {
    url,
    formats: ['markdown', 'html'],
    onlyMainContent: !fullContent,
  }
  if (sourceType === 'web_blog') {
    return { ...base, actions: [{ type: 'wait', milliseconds: 2000 }] }
  }
  return base
}
