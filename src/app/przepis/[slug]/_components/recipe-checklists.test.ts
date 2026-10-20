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
      steps: ['Dynię pokroić.', '2 ząbki czosnku posiekać.'],
      servings,
    }),
  )
}

describe('RecipeChecklists headings (C3)', () => {
  it('puts "na N porcji" on the "Składniki" row, 16 px secondary', () => {
    expect(render(4)).toMatch(
      /<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3"><h2 id="ingredients-heading" class="min-w-0 text-\[24px\] font-bold text-ink">Składniki<\/h2><p class="min-w-0 text-\[16px\] text-ink-soft">na 4 porcje<\/p><\/div>/,
    )
  })

  it('leaves the row to the heading when the servings are unknown', () => {
    expect(render(null)).toContain('<h2 id="ingredients-heading" class="min-w-0 text-[24px] font-bold text-ink">Składniki</h2></div>')
  })

  it('sets the section headings at 24 px (README: H2 22–24 px)', () => {
    expect(render(null)).toContain('<h2 id="steps-heading" class="mb-3 text-[24px] font-bold text-ink">Przygotowanie</h2>')
  })
})

describe('RecipeChecklists "Wielkość tekstu" (C3)', () => {
  it('labels the control in primary ink', () => {
    expect(render(null)).toContain('<span id="text-size-label" class="min-w-0 text-[16px] font-bold wrap-anywhere text-ink">Wielkość tekstu</span>')
  })
})

// Owner decision 2026-10-20: „Krok 1” over each step, in an ordered list (screen readers
// announce the position); the total „z M” only in cooking mode.
describe('RecipeChecklists steps', () => {
  it('labels each step „Krok N” without the total, in an ordered list', () => {
    const list = render(null).match(/<ol class="space-y-5">.*?<\/ol>/)?.[0] ?? ''
    expect(list).toContain('<p class="mb-1.5 text-[17px] font-bold text-action-text">Krok 1</p>')
    expect(list).toContain('<p class="mb-1.5 text-[17px] font-bold text-action-text">Krok 2</p>')
    expect(list).not.toContain(' z 2')
  })

  it('keeps „Krok N z M” in cooking mode, one step at a time', () => {
    expect(render(null)).toContain('>Krok 1 z 2</p>')
  })
})

