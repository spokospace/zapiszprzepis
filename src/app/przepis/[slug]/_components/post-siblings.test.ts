import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PostSiblings } from './post-siblings'

const SOURCE = { sourceUrl: 'https://slushna.by/menu/', sourceName: 'slushna.by' }

function render(siblings: Parameters<typeof PostSiblings>[0]['siblings']) {
  return renderToStaticMarkup(createElement(PostSiblings, { ...SOURCE, siblings }))
}

describe('PostSiblings — a single-recipe page is unchanged', () => {
  it('renders nothing when the link has no other dishes', () => {
    expect(render([])).toBe('')
  })
})

describe('PostSiblings — a link with several dishes', () => {
  const SIBLINGS = [
    { id: 41, slug: 'salatka-z-rzodkwi', title: 'Sałatka z rzodkwi' },
    { id: 43, slug: 'smaraniki', title: 'Smażaniki' },
  ]

  it('links the source with the name it is given', () => {
    const html = render(SIBLINGS)
    expect(html).toContain('Z wpisu:')
    expect(html).toContain('href="https://slushna.by/menu/"')
    expect(html).toContain('>slushna.by</a>')
  })

  it('lists each sibling as a link to its own recipe page', () => {
    const html = render(SIBLINGS)
    expect(html).toContain('Inne przepisy z tego wpisu')
    expect(html).toContain('href="/przepis/salatka-z-rzodkwi"')
    expect(html).toContain('href="/przepis/smaraniki"')
    expect(html).toContain('Sałatka z rzodkwi')
    expect(html).toContain('Smażaniki')
  })

  it('gives each sibling link a 48 px touch target', () => {
    const html = render(SIBLINGS)
    expect(html.match(/min-h-12/g)).toHaveLength(SIBLINGS.length)
  })
})
