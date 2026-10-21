import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LegalPage, LegalSection } from './legal-page'

describe('LegalPage headings (#392)', () => {
  it('binds one-letter words in the page title to the next word', () => {
    const html = renderToStaticMarkup(LegalPage({ title: 'Jak usunąć konto i swoje dane', children: null }))
    expect(html).toContain('Jak usunąć konto i\u00a0swoje dane')
  })

  it('binds one-letter words in section titles, keeping the body text as written', () => {
    const html = renderToStaticMarkup(
      LegalSection({ id: 'tresci', title: '5. Linki i treści, które dodajesz', children: 'Treść i opis' }),
    )
    expect(html).toContain('5. Linki i\u00a0treści, które dodajesz')
    expect(html).toContain('Treść i opis')
  })
})
