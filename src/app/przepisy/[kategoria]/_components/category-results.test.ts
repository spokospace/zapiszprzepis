import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CategoryCard } from '@/lib/category-list'
import { CategoryResults } from './category-results'

const card = (i: number, tags: string[]): CategoryCard => ({
  id: i,
  slug: `przepis-${i}`,
  title: `Przepis ${i}`,
  image_url: null,
  category: 'ciasta',
  source_type: 'web_blog',
  source_url: `https://example.com/${i}`,
  source_author: null,
  tags,
})

const cards = Array.from({ length: 30 }, (_, i) => card(i + 1, i < 5 ? ['grill'] : ['kruche']))

// The server (and so the saved file) renders the bare list: the query is read only in the browser.
const html = renderToStaticMarkup(createElement(CategoryResults, { category: 'ciasta', label: 'Ciasta', cards }))

describe('CategoryResults as saved in the file (no query)', () => {
  it('shows the first page of every card and the whole count', () => {
    expect(html.match(/<li [^>]*id="wynik-\d+"/g)).toHaveLength(24)
    expect(html).toContain('Wszystkie: 30')
    expect(html).toContain('id="wynik-24"')
    expect(html).not.toContain('id="wynik-25"')
  })

  it('links every later recipe without JS (no ?strona= link, which the file would answer with page 1 again)', () => {
    expect(html).toContain('<noscript>')
    for (let i = 25; i <= 30; i++) expect(html).toContain(`href="/przepis/przepis-${i}"`)
    expect(html).not.toContain('strona=2')
    expect(html).not.toContain('Pokaż kolejne')
  })

  it('links every tag as a plain address', () => {
    expect(html).toContain('href="/przepisy/ciasta?tag=kruche"')
    expect(html).toContain('href="/przepisy/ciasta?tag=grill"')
  })

  it('counts each chip over the whole category', () => {
    expect(html).toMatch(/kruche[^<]*<\/span><span[^>]*>25/)
  })
})
