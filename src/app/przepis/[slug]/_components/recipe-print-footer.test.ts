import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipePrintFooter } from './recipe-print-footer'

function render(props: Partial<Parameters<typeof RecipePrintFooter>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(RecipePrintFooter, {
      sourceType: 'web_blog',
      sourceUrl: 'https://aniagotuje.pl/przepis/placki',
      sourceAuthor: null,
      canonicalUrl: 'https://zapiszprzepis.pl/przepis/placki-ziemniaczane',
      ...props,
    }),
  )
}

describe('RecipePrintFooter (print-only source line)', () => {
  it('shows the source and the address without its protocol', () => {
    const html = render()
    expect(html).toContain('Źródło:')
    expect(html).toContain('aniagotuje.pl')
    expect(html).toContain('zapiszprzepis.pl/przepis/placki-ziemniaczane')
    // The protocol is dropped from the printed address.
    expect(html).not.toContain('https://zapiszprzepis.pl')
  })

  it('is hidden on screen and shown only on print', () => {
    const html = render()
    expect(html).toMatch(/^<div class="[^"]*hidden[^"]*print:block/)
  })

  it('still names the app address for a recipe with no source URL', () => {
    const html = render({ sourceType: 'other', sourceUrl: null, sourceAuthor: null })
    expect(html).toContain('zapiszprzepis.pl/przepis/placki-ziemniaczane')
  })
})
