import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'


import { SearchSuggestions } from './search-suggestions'

describe('SearchSuggestions (E01-S29)', () => {
  it('shows nothing until the visitor types — only an empty polite status region', () => {
    const html = renderToStaticMarkup(createElement(SearchSuggestions, { fieldId: 'f', initialValue: 'dynia' }))
    expect(html).toBe('<p role="status" aria-live="polite" class="sr-only"></p>')
  })
})
