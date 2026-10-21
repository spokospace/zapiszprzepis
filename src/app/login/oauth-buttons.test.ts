import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./actions', () => ({ signInWithOAuthProvider: vi.fn() }))

import { OAuthButtons } from './oauth-buttons'

describe('OAuthButtons — screen 3a (E01-S12b)', () => {
  it('renders nothing while OAuth is off', () => {
    expect(renderToStaticMarkup(createElement(OAuthButtons, { providers: [] }))).toBe('')
  })

  it('shows Facebook on brand blue and Google outlined, each posting its provider and next', () => {
    const html = renderToStaticMarkup(createElement(OAuthButtons, { providers: ['facebook', 'google'], next: '/dodaj' }))
    expect(html.indexOf('Zaloguj przez Facebooka')).toBeLessThan(html.indexOf('Zaloguj przez Google'))
    expect(html).toContain('bg-facebook')
    expect(html).toContain('border-ink')
    expect(html).toContain('value="facebook"')
    expect(html).toContain('value="google"')
    expect(html.match(/name="next" value="\/dodaj"/g)).toHaveLength(2)
  })
})
