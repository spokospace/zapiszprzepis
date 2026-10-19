import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeChecklists } from './recipe-checklists'

function render(servings: number | null) {
  return renderToStaticMarkup(
    createElement(RecipeChecklists, {
      recipeId: 1,
      title: 'Zupa krem z dyni',
      ingredientGroups: [{ section: null, items: [{ name: 'dynia', amount: '1', unit: 'kg' }] }],
      steps: ['Dynię pokroić.'],
      servings,
    }),
  )
}

describe('RecipeChecklists headings (C3)', () => {
  it('puts "na N porcji" on the "Składniki" row, 16 px secondary', () => {
    expect(render(4)).toMatch(
      /<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3"><h2 id="ingredients-heading" class="text-\[24px\] font-bold text-ink">Składniki<\/h2><p class="text-\[16px\] text-ink-soft">na 4 porcje<\/p><\/div>/,
    )
  })

  it('leaves the row to the heading when the servings are unknown', () => {
    expect(render(null)).toContain('<h2 id="ingredients-heading" class="text-[24px] font-bold text-ink">Składniki</h2></div>')
  })

  it('sets the section headings at 24 px (README: H2 22–24 px)', () => {
    expect(render(null)).toContain('<h2 id="steps-heading" class="mb-3 text-[24px] font-bold text-ink">Przygotowanie</h2>')
  })
})
