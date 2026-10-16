import { describe, it, expect } from 'vitest'
import { findNextPageUrl } from '@/lib/paginated-article'

const ARTICLE = 'https://obiady.foodmeld.com/babcine-ciasteczka/2819/2026/'

// Mirrors the real "Dalej »" navigation of a split WordPress article (#168).
const nav = (href: string) =>
  `<nav class="post-page-nav" aria-label="Page navigation"><a class="post-page-nav__btn post-page-nav__next" href="${href}">Dalej » &rarr;</a></nav>`

describe('findNextPageUrl', () => {
  it('finds page 2 linked from page 1', () => {
    expect(findNextPageUrl(nav(`${ARTICLE}2/`), ARTICLE, 1)).toBe(`${ARTICLE}2/`)
  })

  it('finds page 3 linked from page 2, without a trailing slash or with tracking', () => {
    expect(findNextPageUrl(nav(`${ARTICLE}3`), ARTICLE, 2)).toBe(`${ARTICLE}3/`)
    expect(findNextPageUrl(nav(`${ARTICLE}3/?utm_source=FB98154`), ARTICLE, 2)).toBe(`${ARTICLE}3/`)
  })

  it('resolves a relative link', () => {
    expect(findNextPageUrl(nav('/babcine-ciasteczka/2819/2026/2/'), ARTICLE, 1)).toBe(`${ARTICLE}2/`)
  })

  it('works when the article URL has no trailing slash', () => {
    expect(findNextPageUrl(nav(`${ARTICLE}2/`), ARTICLE.slice(0, -1), 1)).toBe(`${ARTICLE}2/`)
  })

  it('ignores the last page, a back link and other articles', () => {
    // Page 4 links back to 3 only.
    expect(findNextPageUrl(nav(`${ARTICLE}3/`), ARTICLE, 4)).toBeNull()
    // A related post's own page 2 is another article.
    expect(findNextPageUrl(nav('https://obiady.foodmeld.com/inny-przepis/1/2026/2/'), ARTICLE, 1)).toBeNull()
    expect(findNextPageUrl('<p>no navigation</p>', ARTICLE, 1)).toBeNull()
  })

  it('returns null for an unparseable article URL', () => {
    expect(findNextPageUrl(nav(`${ARTICLE}2/`), 'not a url', 1)).toBeNull()
  })
})
