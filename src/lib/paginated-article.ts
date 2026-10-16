// Some recipe sites split one article over pages with a "Dalej »" button —
// WordPress's <!--nextpage-->, served as <article>/2/, <article>/3/, … Page 1
// then holds the intro and part of the ingredients, and the recipe can only be
// read from all of them together. Firecrawl's main-content output drops that
// navigation, so the link is looked for in the page's raw HTML instead.

/** Extra pages read after the first one; bounds the scrapes per share. */
export const MAX_EXTRA_PAGES = 4

const HREF_RE = /\bhref\s*=\s*["']([^"']+)["']/gi

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * The URL of page `page + 1` of the article at `articleUrl` (its first page),
 * when `html` links to it; otherwise null. Only a link to this article's own
 * next page counts — a related post's /2/ is another article.
 */
export function findNextPageUrl(html: string, articleUrl: string, page: number): string | null {
  let base: URL
  try {
    base = new URL(articleUrl)
  } catch {
    return null
  }
  base.search = ''
  base.hash = ''
  const next = `${withoutTrailingSlash(base.toString())}/${page + 1}`

  for (const [, href] of html.matchAll(HREF_RE)) {
    let target: URL
    try {
      target = new URL(href.replace(/&amp;/g, '&'), base)
    } catch {
      continue
    }
    target.search = ''
    target.hash = ''
    if (withoutTrailingSlash(target.toString()) === next) return `${next}/`
  }
  return null
}
