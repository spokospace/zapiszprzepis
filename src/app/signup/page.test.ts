import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./signup-form', () => ({ SignUpForm: () => null }))

import SignUpPage from './page'

describe('/signup logo (laid out like screen 3a, #331)', () => {
  it('shows the shared icon + "ZapiszPrzepis" logo with one accessible name, not the old lettering', async () => {
    const html = renderToStaticMarkup(await SignUpPage({ searchParams: Promise.resolve({}) }))
    const logo = html.match(/<div role="img" aria-label="ZapiszPrzepis"[^>]*>.*?Przepis<\/span><\/span><\/div>/)?.[0] ?? ''
    expect(logo).toContain('src="/logo-icon.svg"')
    expect(logo).toContain('>Zapisz</span>')
    expect(html).not.toContain('logo-lettering')
  })
})
