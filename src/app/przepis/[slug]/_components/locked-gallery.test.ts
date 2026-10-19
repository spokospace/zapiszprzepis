import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LockedGallery } from './locked-gallery'

describe('LockedGallery (A5)', () => {
  it('says the gallery is available after signing in, with a dark "Zaloguj się"', () => {
    const html = renderToStaticMarkup(createElement(LockedGallery, { count: 6, loginHref: '/login?next=%2Fprzepis%2Fa' }))
    expect(html).toContain('jest dostępna po zalogowaniu.')
    const login = html.match(/<a[^>]*>Zaloguj się<\/a>/)?.[0] ?? ''
    expect(login).toContain('href="/login?next=%2Fprzepis%2Fa"')
    expect(login).toContain('bg-ink')
    expect(login).not.toContain('bg-action')
  })
})
