import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { findGlossaryTerms } from '@/lib/ingredient-glossary'
import { IngredientGlossary } from './ingredient-glossary'
import { RecipeChecklists } from './recipe-checklists'

const render = (...texts: string[]) =>
  renderToStaticMarkup(createElement(IngredientGlossary, { entries: findGlossaryTerms(texts) }))

describe('IngredientGlossary (#544)', () => {
  it('renders nothing when the recipe mentions no glossary term', () => {
    expect(render('Rosół', 'marchew')).toBe('')
  })

  it('gives each term a labelled 48 px disclosure, not a hover-only tooltip', () => {
    const html = render('Domowe SpaghettiOs z chrupiącym serem Manchego')
    expect(html).toContain('<section aria-labelledby="glossary-heading"')
    expect(html).toContain('id="glossary-heading"')
    expect(html).toMatch(/<details[^>]*><summary class="[^"]*min-h-12[^"]*"><span[^>]*>Co to jest manchego\?<\/span>/)
    expect(html).not.toContain('title=')
  })

  it('shows the explanation and the substitute inside the disclosure', () => {
    const html = render('ser manchego')
    const details = html.match(/<details[\s\S]*?<\/details>/)?.[0] ?? ''
    expect(details).toContain('Twardy hiszpański ser z mleka owczego')
    expect(details).toContain('<b class="text-ink">Zamiennik:</b> parmezan lub dojrzała gouda')
  })

  it('omits the substitute line when there is none', () => {
    expect(render('guacamole')).not.toContain('Zamiennik')
  })
})

describe('RecipeChecklists glossary placement', () => {
  const html = (glossary = findGlossaryTerms(['pancetta'])) =>
    renderToStaticMarkup(
      createElement(RecipeChecklists, {
        recipeId: 1,
        ingredientGroups: [{ section: null, items: [{ name: 'pancetta', amount: '100', unit: 'g' }] }],
        steps: ['Podsmaż pancettę.'],
        servings: null,
        glossary,
      }),
    )

  it('sits in the Składniki panel, under the list', () => {
    const section = html().match(/<section aria-labelledby="ingredients-heading"[\s\S]*?<\/ul><\/section><\/section>/)?.[0] ?? ''
    expect(section).toContain('Co to jest pancetta?')
  })

  it('leaves the page as before without terms', () => {
    expect(html([])).not.toContain('glossary-heading')
  })
})
