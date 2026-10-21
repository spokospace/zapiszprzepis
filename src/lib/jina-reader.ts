// Jina Reader (r.jina.ai) renders a page and returns it as markdown — free,
// no key needed (about 20 requests a minute without one). It stands in for
// Firecrawl when that fails or runs out of credits (HTTP 402): the markdown
// feeds the LLM, and the page's own HTML, fetched directly, keeps the photos,
// JSON-LD and embedded players the rest of the pipeline reads.

import { isPrivateUrl } from './recipe-image-archive'
import { fetchPublicHtml } from './public-fetch'

const JINA_READER = 'https://r.jina.ai/'

/** The same shape as Firecrawl's scrape `data`, so callers take either. */
export interface ReaderPage {
  markdown: string
  html: string
  metadata: { url?: string; ogImage?: string; statusCode?: number }
}

interface Deps {
  fetch: typeof globalThis.fetch
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

async function readMarkdown(url: string, { fetch }: Deps): Promise<Omit<ReaderPage, 'html'>> {
  const response = await fetch(`${JINA_READER}${url}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json())?.data
  const content = str(data?.content)
  if (!content) throw new Error('no content')
  // The markdown often starts below the post's heading; the title is the
  // LLM's strongest signal, so it leads.
  const title = str(data.title)
  return {
    markdown: title && !content.includes(title) ? `# ${title}\n\n${content}` : content,
    metadata: {
      url: str(data.url) || undefined,
      ogImage: str(data.metadata?.['og:image']) || undefined,
      statusCode: typeof data.httpStatus === 'number' ? data.httpStatus : undefined,
    },
  }
}

/**
 * The page through Jina Reader plus its raw HTML. Throws "Jina Reader: …" with
 * the reason when Jina has no content for it, so the caller can store why.
 */
export async function readerScrape(url: string, deps: Deps): Promise<ReaderPage> {
  if (isPrivateUrl(url)) throw new Error('Jina Reader: private address')
  const [read, html] = await Promise.all([
    readMarkdown(url, deps).catch((err) => {
      throw new Error(`Jina Reader: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
    }),
    fetchPublicHtml(url, deps),
  ])
  return { ...read, html: html ?? '' }
}
