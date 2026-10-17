import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({ saveGender: vi.fn() }))

import { GenderForm } from './gender-form'

describe('GenderForm — screen 3b (E01-S12b)', () => {
  it('asks "Jestem" with two native radios and the final-choice note', () => {
    const html = renderToStaticMarkup(createElement(GenderForm, { next: '/' }))
    expect(html).toContain('<legend')
    expect(html).toContain('Jestem')
    expect(html).toContain('Kobietą')
    expect(html).toContain('Mężczyzną')
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).toContain('Tego nie można później zmienić w ustawieniach.')
  })

  it('keeps "Dalej" enabled in the server HTML so the form submits without JS', () => {
    const html = renderToStaticMarkup(createElement(GenderForm, { next: '/' }))
    expect(html).toContain('Dalej')
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/)
  })

  it('shows a server error as an alert', () => {
    const html = renderToStaticMarkup(createElement(GenderForm, { next: '/', error: 'invalid' }))
    expect(html).toContain('role="alert"')
    expect(html).toContain('Wybierz jedną z odpowiedzi.')
  })
})
