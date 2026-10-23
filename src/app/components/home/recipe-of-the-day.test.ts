import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeOfTheDay } from './recipe-of-the-day'

const html = renderToStaticMarkup(
  createElement(RecipeOfTheDay, {
    slug: 'sernik',
    title: 'Sernik na zimno',
    imageUrl: null,
    description: 'Kremowy, bez pieczenia',
    sourceType: 'web_blog',
    sourceUrl: 'https://aniagotuje.pl/sernik',
    sourceAuthor: null,
  }),
)

describe('RecipeOfTheDay (handoff 14)', () => {
  it('is one link named after the recipe, under a 1 px ink rule', () => {
    expect(html).toContain('border-t border-ink')
    expect(html).toContain('href="/przepis/sernik"')
    expect(html).toContain('aria-label="Przepis dnia: Sernik na zimno"')
    expect(html.match(/<a /g)).toHaveLength(1)
  })

  it('splits 7fr / 5fr from md with a 360 px, 4 px photo and the source tab', () => {
    expect(html).toContain('md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]')
    expect(html).toContain('md:h-[360px]')
    expect(html).toContain('md:rounded-tile')
    expect(html).toContain('aniagotuje.pl')
  })

  it('shows the label, 40 px title, subtitle and an underlined "Zobacz przepis →"', () => {
    expect(html).toMatch(/uppercase">Przepis dnia</)
    expect(html).toContain('md:text-[40px]')
    expect(html).toContain('Kremowy, bez pieczenia')
    // NBSP before the arrow so „→” never strands on its own line at a large font (#478).
    expect(html).toMatch(/underline[^"]*">Zobacz przepis →</)
  })

  it('does not put the text on the photo', () => {
    expect(html).not.toContain('bg-gradient')
    expect(html).not.toContain('linear-gradient')
  })
})
