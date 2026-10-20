import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomeSearch } from './home-search'

describe('HomeSearch field', () => {
  // „Wyczyść” is the one labelled clear button; the browser's unlabelled ✕ of
  // type="search" beside it read as a second control.
  it('hides the browser’s own clear button of the search input', () => {
    const html = renderToStaticMarkup(createElement(HomeSearch, { id: 'f', defaultValue: 'dynia', compact: true }))
    const input = html.match(/<input[^>]*type="search"[^>]*>/)?.[0] ?? ''
    expect(input).toContain('[&amp;::-webkit-search-cancel-button]:appearance-none')
    expect(html).toContain('Wyczyść')
  })
})
