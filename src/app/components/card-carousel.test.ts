import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CardCarousel } from './card-carousel'

const html = renderToStaticMarkup(
  createElement(CardCarousel, {
    label: 'Ostatnio dodane',
    items: [1, 2, 3].map((n) => ({ key: n, card: createElement('article', null, `Przepis ${n}`) })),
  }),
)

describe('CardCarousel', () => {
  it('is a snapping strip on a phone and a grid from sm, one <li> per card', () => {
    const ul = html.match(/<ul id="([^"]+)" class="([^"]+)"/)
    expect(ul?.[2]).toMatch(/(^| )overflow-x-auto( |$)/)
    expect(ul?.[2]).toContain('snap-x')
    expect(ul?.[2]).toContain('sm:grid sm:grid-cols-2')
    expect(ul?.[2]).toContain('lg:grid-cols-4')
    expect(html.match(/<li class="w-3\/4 shrink-0 snap-start sm:w-auto"><article>/g)).toHaveLength(3)
  })

  it('gives a phone two labelled 48 px buttons for the strip, with no gesture needed', () => {
    const listId = html.match(/<ul id="([^"]+)"/)?.[1]
    const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button).toContain(`aria-controls="${listId}"`)
      expect(button).toContain('min-h-[48px]')
      expect(button).toMatch(/<svg[^>]*aria-hidden="true"/)
    }
    expect(buttons[0]).toMatch(/>Poprzednie<span class="sr-only">: Ostatnio dodane<\/span>/)
    expect(buttons[1]).toMatch(/>Następne<span class="sr-only">: Ostatnio dodane<\/span>/)
    expect(html).toMatch(/<div class="[^"]*sm:hidden[^"]*"><button/)
  })

  it('starts at the first card: "Poprzednie" is off without leaving the focus order, "Następne" is on', () => {
    const [prev, next] = html.match(/<button[^>]*>/g) ?? []
    expect(prev).toContain('aria-disabled="true"')
    expect(next).toContain('aria-disabled="false"')
    expect(prev).not.toMatch(/\sdisabled(=|\s|>)/)
  })
})
