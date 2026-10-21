import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SourceBadge } from './source-badge'

const render = (props: Partial<Parameters<typeof SourceBadge>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(SourceBadge, { kind: 'website', text: 'aniagotuje.pl', variant: 'card', ...props }),
  )

describe('SourceBadge', () => {
  it('shows the kind icon and the text on a card, as a non-link', () => {
    const html = render({ kind: 'youtube', text: 'YouTube · Kuchnia Ani' })
    expect(html).toContain('lucide-monitor-play')
    expect(html).toContain('YouTube · Kuchnia Ani')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('lucide-external-link')
  })

  it('clips a long name to one line', () => {
    expect(render()).toContain('truncate')
  })

  it('shows the platform mark for a blog hosted on WordPress / Blogger', () => {
    expect(render({ kind: 'blogger', text: 'kuchennepoczynaniamoniki' })).toContain('source-icon-blogger')
    expect(render({ kind: 'wordpress', text: 'panimkuchniasmakowita' })).toContain('source-icon-wordpress')
  })

  it('on the recipe page links to the original in a new tab, with the name underlined', () => {
    const html = render({
      variant: 'recipe',
      kind: 'website',
      text: 'aniagotuje.pl',
      href: 'https://aniagotuje.pl/zupa',
    })
    expect(html).toContain('href="https://aniagotuje.pl/zupa"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
    expect(html).toContain('aria-label="Otwórz oryginał: aniagotuje.pl (nowa karta)"')
    expect(html).toContain('lucide-external-link')
    expect(html).toMatch(/truncate underline/)
  })

  it('a page-less source (book / person) is a plain badge: no link, no ExternalLink, no border', () => {
    const html = render({ variant: 'recipe', kind: 'book', text: 'Z książki kucharskiej' })
    expect(html).toContain('lucide-book-open')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('lucide-external-link')
    expect(html).not.toContain('border-2')
  })
})
