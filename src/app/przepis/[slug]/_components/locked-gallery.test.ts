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

  it('is a neutral dashed box, not an accent one (A5)', () => {
    const html = renderToStaticMarkup(createElement(LockedGallery, { count: 6, loginHref: '/login' }))
    const box = html.match(/<div class="[^"]*border-dashed[^"]*">/)?.[0] ?? ''
    expect(box).toContain('bg-surface-2')
    expect(box).toContain('border-[1.5px] border-dashed border-border-card-2')
    expect(box).not.toContain('bg-surface-accent')
    expect(html).toContain('<p class="mt-2.5 mb-3 text-[18px] leading-[1.45] text-ink">Galeria 6 zdjęć jest dostępna po zalogowaniu.</p>')
    // Block flow: a centred flex column would not wrap a long word at 320 px.
    expect(box).not.toContain('flex')
    expect(html.match(/<a[^>]*>Zaloguj się<\/a>/)?.[0]).toContain('min-h-[48px]')
  })
})
