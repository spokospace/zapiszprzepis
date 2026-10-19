import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./signin-form', () => ({ SignInForm: () => null }))
vi.mock('./oauth-buttons', () => ({ OAuthButtons: () => null }))

import LoginPage from './page'

describe('/login logo (screen 3a, #331)', () => {
  it('shows the icon + "ZapiszPrzepis" wordmark with one accessible name, not the old lettering', async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }))
    const logo = html.match(/<div role="img" aria-label="ZapiszPrzepis"[^>]*>.*?Przepis<\/span><\/span><\/div>/)?.[0] ?? ''
    expect(logo).toContain('src="/logo-icon.svg"')
    expect(logo).toContain('alt=""')
    expect(logo).toContain('<span aria-hidden="true"')
    expect(logo).toContain('>Zapisz</span>')
    expect(html).not.toContain('logo-lettering')
  })
})
