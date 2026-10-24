import { describe, it, expect } from 'vitest'
import { recipeToMarkdown, type RecipeForMarkdown } from './recipe-markdown'

const base: RecipeForMarkdown = {
  slug: 'sernik-krakowski',
  title: 'Sernik krakowski',
  description: 'Klasyczny sernik z kratką.',
  meta_description: null,
  ingredients: [
    { name: 'twaróg', amount: '1', unit: 'kg', section: 'Masa serowa' },
    { name: 'cukier', amount: '20', unit: 'dag', section: 'Masa serowa' },
    { name: 'mąka', amount: '2', unit: 'szklanki', alt: 'ok. 250 g', section: 'Ciasto' },
  ],
  steps: ['Zmiel twaróg.', 'Dodaj cukier i jajka.', 'Piecz 60 minut.'],
  prep_time_minutes: 30,
  cook_time_minutes: 60,
  total_time_minutes: 90,
  servings: 12,
  source_type: 'web_blog',
  source_url: 'https://aniagotuje.pl/przepis/sernik',
  source_author: null,
  youtube_id: null,
}

const SITE = 'https://zapiszprzepis.pl'

describe('recipeToMarkdown', () => {
  it('renders title, meta, description, grouped ingredients, numbered steps and footer in order', () => {
    const md = recipeToMarkdown(base, SITE)
    expect(md.startsWith('# Sernik krakowski\n')).toBe(true)
    expect(md).toContain('Czas całkowity: 90 min · Porcje: 12 · Źródło: aniagotuje.pl')
    expect(md).toContain('Klasyczny sernik z kratką.')
    expect(md).toContain('## Składniki')
    expect(md).toContain('### Masa serowa')
    expect(md).toContain('- 1 kg twaróg') // no alt → no parentheses
    expect(md).toContain('### Ciasto')
    expect(md).toContain('- 2 szklanki mąka (ok. 250 g)') // household measure appended (#505)
    expect(md).toContain('## Przygotowanie')
    expect(md).toContain('1. Zmiel twaróg.')
    expect(md).toContain('3. Piecz 60 minut.')
    expect(md).toContain(`Przepis na [zapiszprzepis.pl](${SITE}/przepis/sernik-krakowski).`)
    expect(md).toContain('[Otwórz oryginał na aniagotuje.pl](https://aniagotuje.pl/przepis/sernik)')

    // Section order: Składniki before Przygotowanie before footer.
    expect(md.indexOf('## Składniki')).toBeLessThan(md.indexOf('## Przygotowanie'))
    expect(md.indexOf('## Przygotowanie')).toBeLessThan(md.indexOf('---'))
  })

  it('falls back to a derived description when none is stored', () => {
    const md = recipeToMarkdown({ ...base, description: null, meta_description: null }, SITE)
    // buildFallbackMetaDescription yields a non-empty sentence mentioning the dish.
    expect(md).toMatch(/# Sernik krakowski\n\n.+\n\n.+/)
  })

  it('links YouTube as the original when there is no source_url', () => {
    const md = recipeToMarkdown(
      { ...base, source_type: 'youtube', source_url: null, source_author: 'Kuchnia Ani', youtube_id: 'abc123' },
      SITE,
    )
    expect(md).toContain('Źródło: YouTube · Kuchnia Ani')
    expect(md).toContain('[Otwórz oryginał na YouTube](https://www.youtube.com/watch?v=abc123)')
  })

  it('uses prep/cook times when no total is set, and omits empty ingredient parts', () => {
    const md = recipeToMarkdown(
      {
        ...base,
        total_time_minutes: null,
        ingredients: [{ name: 'sól', section: '' }],
        servings: null,
      },
      SITE,
    )
    expect(md).toContain('Przygotowanie: 30 min · Gotowanie: 60 min · Źródło:')
    expect(md).not.toContain('Porcje:')
    expect(md).toContain('- sól')
    expect(md).not.toContain('### ') // no section header for the empty section
  })
})
