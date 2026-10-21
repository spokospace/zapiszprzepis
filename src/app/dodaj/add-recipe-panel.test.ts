import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./add-from-link-form', () => ({
  AddFromLinkForm: ({ error, autoFocus }: { error?: string | null; autoFocus?: boolean }) =>
    createElement('div', { 'data-testid': 'link-form', 'data-error': String(error), 'data-autofocus': String(autoFocus) }),
}))

import { AddRecipePanel } from './add-recipe-panel'

describe('AddRecipePanel — A7 (E01-S10)', () => {
  it('shows "Z linku" as the live source and "Ze zdjęcia" as coming soon, in words', () => {
    const html = renderToStaticMarkup(createElement(AddRecipePanel))
    expect(html).toContain('Skąd dodajesz przepis?')
    expect(html).toContain('Z linku')
    expect(html).toContain('Ze zdjęcia')
    expect(html).toContain('wkrótce')
    // Status tiles, not a fake toggle: the only control is the link form.
    expect(html).not.toContain('<button')
  })

  it('lists the three steps in order', () => {
    const html = renderToStaticMarkup(createElement(AddRecipePanel))
    expect(html).toContain('Jak to działa')
    expect(html.match(/<li>/g)).toHaveLength(3)
    expect(html.indexOf('Wklejasz link')).toBeLessThan(html.indexOf('1–3 minuty'))
    expect(html).toContain('dzwonek da znać o\u00a0problemie')
    expect(html).toContain('Udostępnij → Zapisz Przepis')
  })

  it('binds one-letter words to the next word so none ends a line (#392)', () => {
    const html = renderToStaticMarkup(createElement(AddRecipePanel))
    expect(html).toContain('pojawi się w\u00a0„Moje przepisy”, a\u00a0dzwonek')
    expect(html).toContain('prosto z\u00a0Facebooka')
    expect(html).not.toMatch(/ [aiouwz] /)
  })

  it('passes the error and focus through to the link form', () => {
    const html = renderToStaticMarkup(createElement(AddRecipePanel, { error: 'server', autoFocus: true }))
    expect(html).toContain('data-error="server"')
    expect(html).toContain('data-autofocus="true"')
  })
})
