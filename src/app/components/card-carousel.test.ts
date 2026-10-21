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
    expect(ul?.[2]).toMatch(/(^| )sm:grid( |$)/)
    expect(ul?.[2]).toMatch(/(^| )sm:grid-cols-2 lg:grid-cols-4( |$)/)
    expect(html.match(/<li class="w-3\/4 shrink-0 snap-start sm:w-auto"><article>/g)).toHaveLength(3)
  })

  it('gives a phone two labelled 56 px buttons for the strip, with no gesture needed', () => {
    const listId = html.match(/<ul id="([^"]+)"/)?.[1]
    const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button).toContain(`aria-controls="${listId}"`)
      expect(button).toContain('min-h-[56px]')
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

describe('CardCarousel versions layout (handoff 16)', () => {
  const html = renderToStaticMarkup(
    createElement(CardCarousel, { label: 'Inne wersje', layout: 'versions', items: [{ key: 1, card: 'x' }] }),
  )

  it('is two columns from sm and three from lg, rows 32 px apart, with room for a card focus ring', () => {
    const cls = html.match(/<ul id="[^"]+" class="([^"]+)"/)?.[1] ?? ''
    expect(cls).toMatch(/(^| )sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-3( |$)/)
    expect(cls).not.toContain('lg:grid-cols-4')
    expect(cls).toMatch(/(^| )-mt-2 .*(^| )pt-2( |$)/)
  })

  it('makes each card 270 px wide on a phone, a grid cell from sm', () => {
    expect(html).toContain('<li class="w-[270px] shrink-0 snap-start sm:w-auto">')
  })

  it('keeps the tiles layout at 3/4 of the screen with 32 px between rows from lg', () => {
    const tiles = renderToStaticMarkup(createElement(CardCarousel, { label: 'x', items: [{ key: 1, card: 'x' }] }))
    expect(tiles).toContain('<li class="w-3/4 shrink-0 snap-start sm:w-auto">')
    expect(tiles).toContain('lg:gap-x-5 lg:gap-y-8')
  })

  it('has 56 px phone buttons that share the row', () => {
    const buttons = html.match(/<button[^>]*>/g) ?? []
    expect(buttons.length).toBe(2)
    for (const b of buttons) expect(b).toContain('min-h-[56px]')
  })
})
