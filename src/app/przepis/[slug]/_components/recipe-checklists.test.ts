import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeChecklists, stepProgress } from './recipe-checklists'

function render(servings: number | null, stepImages?: string[]) {
  return renderToStaticMarkup(
    createElement(RecipeChecklists, {
      recipeId: 1,
      ingredientGroups: [{ section: null, items: [{ name: 'dynia', amount: '1', unit: 'kg' }] }],
      steps: ['Dynię pokroić.', '2 ząbki czosnku posiekać.'],
      stepImages,
      servings,
    }),
  )
}

describe('RecipeChecklists headings (C3)', () => {
  it('puts "na N porcji" on the "Składniki" row, 16 px secondary', () => {
    expect(render(4)).toMatch(
      /<div class="mb-3 flex items-baseline justify-between gap-x-3"><div class="flex min-w-0 flex-wrap items-baseline gap-x-3"><h2 id="ingredients-heading" class="shrink-0 text-\[24px\] font-bold text-ink">Składniki<\/h2><p class="min-w-0 text-\[16px\] text-ink-soft">na 4 porcje<\/p><\/div><button type="button" class="min-h-\[48px\] min-w-0 px-1 text-right text-\[17px\] font-bold text-action-text underline hover:text-action-hover print:hidden invisible">Wyczyść zaznaczenia<\/button><\/div>/,
    )
  })

  it('leaves the row to the heading when the servings are unknown', () => {
    expect(render(null)).toContain('<h2 id="ingredients-heading" class="shrink-0 text-[24px] font-bold text-ink">Składniki</h2></div><button type="button"')
  })

  // Regression (#578): the reset control used to mount only once an ingredient was ticked,
  // which pushed both columns down. It now sits in the Składniki card from the first render.
  it('keeps the reset control inside the Składniki section with nothing ticked', () => {
    const html = render(null)
    const section = html.match(/<section aria-labelledby="ingredients-heading"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(section).toContain('Wyczyść zaznaczenia')
    expect(section).toContain(' invisible')
    expect(html.match(/Wyczyść zaznaczenia/g)).toHaveLength(1)
  })

  it('sets the section headings at 24 px (README: H2 22–24 px)', () => {
    // min-w-0 lets the heading wrap at a large system font (#448).
    expect(render(null)).toContain('<h2 id="steps-heading" class="min-w-0 text-[24px] font-bold text-ink">Przygotowanie</h2>')
  })
})

// ZMIANA_zdjecia_krokow: a source photo under the step text, and a „Zdjęcia kroków” toggle,
// only for recipes that have at least one step photo.
describe('RecipeChecklists step photos', () => {
  it('shows no toggle and no step figure when no step has a photo', () => {
    const html = render(null)
    expect(html).not.toContain('aria-label="Zdjęcia kroków"')
    expect(html).not.toContain('<figure')
    expect(html).not.toContain('Zdjęcie do kroku')
  })

  it('renders the „Zdjęcia kroków: Pokaż / Ukryj” group when a step has a photo', () => {
    const html = render(null, ['https://cdn.example/step-1.jpg', ''])
    expect(html).toContain('role="group" aria-label="Zdjęcia kroków"')
    // „Pokaż” is the default (aria-pressed), „Ukryj” is not.
    expect(html).toMatch(/aria-pressed="true"[^>]*>Pokaż</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Ukryj</)
  })

  it('places a 4:3 figure only under the steps that have a photo, with an alt', () => {
    const html = render(null, ['https://cdn.example/step-1.jpg', ''])
    const list = html.match(/<ol class="space-y-5">[\s\S]*<\/ol>/)?.[0] ?? ''
    expect(list).toContain('<figure')
    expect(list).toContain('aspect-[4/3]')
    expect(list).toContain('Zdjęcie do kroku 1')
    // The second step has '' → no figure, no empty frame.
    expect(list).not.toContain('Zdjęcie do kroku 2')
    expect(list.match(/<figure/g)).toHaveLength(1)
  })

  it('makes each step photo a tap-to-enlarge button', () => {
    const html = render(null, ['https://cdn.example/step-1.jpg', ''])
    expect(html).toMatch(/<button[^>]*aria-label="Powiększ zdjęcie do kroku 1"/)
  })
})

// FR #485: the „Wielkość tekstu" control moved to /wyswietlanie. The recipe page no
// longer renders it, but the ingredient and step text still scales — the `.text-scalable`
// classes stay and TextScaleApplier (root layout) applies the saved level app-wide.
describe('RecipeChecklists text size (FR #485)', () => {
  it('no longer renders the inline „Wielkość tekstu" control', () => {
    const html = render(null)
    expect(html).not.toContain('text-size-label')
    expect(html).not.toContain('Wielkość tekstu')
  })

  it('keeps the ingredient and step text scalable', () => {
    const html = render(null)
    expect(html).toContain('<span class="text-scalable min-w-0 flex-1 break-words leading-snug text-ink">dynia</span>')
    expect(html).toContain('<p class="text-scalable leading-[1.6] text-ink">Dynię pokroić.</p>')
  })
})

// #505: a household "alt" measure shows as a lighter 16 px second line under the amount;
// an ingredient without one keeps a single line (no empty second line / stray markup).
describe('RecipeChecklists alternative measure (#505)', () => {
  function renderAlt() {
    return renderToStaticMarkup(
      createElement(RecipeChecklists, {
        recipeId: 1,
        ingredientGroups: [
          {
            section: null,
            items: [
              { name: 'masło', amount: '150', unit: 'g', alt: '3/4 kostki' },
              { name: 'jajka', amount: '4', unit: '' },
            ],
          },
        ],
        steps: ['Wymieszać.'],
        servings: null,
      }),
    )
  }

  it('renders the alt measure as a 16 px ink-soft line under the amount', () => {
    const html = renderAlt()
    expect(html).toContain('<b class="text-scalable text-ink">150 g</b>')
    expect(html).toContain('<span class="text-[16px]"><span class="text-scalable text-ink-soft">3/4 kostki</span></span>')
  })

  it('keeps an ingredient without an alt measure on a single plain amount line', () => {
    const html = renderAlt()
    // The no-alt row keeps the original <b> amount markup and adds no 16 px line.
    expect(html).toContain(
      '<b class="text-scalable max-w-[45%] text-right max-[359px]:max-w-none max-[359px]:basis-full max-[359px]:pl-[46px] max-[359px]:text-left text-ink">4</b>',
    )
    const ingredients = html.match(/<section aria-labelledby="ingredients-heading"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect((ingredients.match(/text-\[16px\]/g) ?? []).length).toBe(1)
  })

  it('keeps words apart in the row text that crawlers extract', () => {
    // Google builds its ingredient snippet from the text, not the layout: adjacent
    // spans with no whitespace between them came out as "masło150 g3/4 kostki".
    const text = renderAlt().replace(/<[^>]+>/g, '')
    expect(text).toContain('masło 150 g 3/4 kostki')
    expect(text).toContain('jajka 4')
  })

  it('derives a household second line for a volume ingredient with no stated measure', () => {
    const html = renderToStaticMarkup(
      createElement(RecipeChecklists, {
        recipeId: 1,
        ingredientGroups: [{ section: null, items: [{ name: 'oleju', amount: '180', unit: 'ml' }] }],
        steps: ['Wymieszać.'],
        servings: null,
      }),
    )
    expect(html).toContain('<b class="text-scalable text-ink">180 ml</b>')
    expect(html).toContain('<span class="text-[16px]"><span class="text-scalable text-ink-soft">ok. 3/4 szklanki</span></span>')
  })
})

// Owner decision 2026-10-20: the total „z M” is only in cooking mode. The 2026-10-28
// handoff adds a numbered, tickable button per step. Ticks are read from sessionStorage on
// the client, so server rendering always shows nothing ticked; the tick logic is covered by
// `stepProgress` below and checked in the browser.
describe('RecipeChecklists steps', () => {
  const list = (html: string) => html.match(/<ol class="space-y-5">[\s\S]*?<\/ol>/)?.[0] ?? ''

  it('labels each step „Krok N” in an ordered list, without the total', () => {
    const items = list(render(null))
    expect(items).toContain('>Krok 1</span>')
    expect(items).toContain('>Krok 2</span>')
    expect(items).not.toContain(' z 2')
  })

  it('makes the step number a toggle with aria-pressed and an accessible name', () => {
    const items = list(render(null))
    expect(items).toContain('<button type="button" aria-pressed="false" aria-label="Krok 1 — oznacz jako zrobiony"')
    expect(items).toContain('<button type="button" aria-pressed="false" aria-label="Krok 2 — oznacz jako zrobiony"')
  })

  it('shows the progress count and no "Teraz" or done message when nothing is ticked', () => {
    const html = render(null)
    expect(html).toContain('2 kroki · kliknij numer, gdy skończysz krok')
    expect(html).not.toContain('Teraz')
    expect(html).not.toContain('Gotowe! Smacznego.')
  })

  it('drops the step numbers on paper', () => {
    expect(list(render(null))).toContain('print:hidden')
  })

  // Owner, 2026-10-29: the progress stays in sight while the steps scroll. The server
  // render has no header to measure yet, so it sticks at the very top until hydration.
  it('keeps the progress line sticky over a white ground, under the app header', () => {
    expect(render(null)).toMatch(/<div class="sticky z-10 [^"]*bg-white[^"]*" style="top:0(px)?">\s*<p[^>]*>2 kroki · kliknij numer/)
  })

  it('keeps a focused step clear of the sticky line', () => {
    expect(list(render(null))).toMatch(/aria-label="Krok 1 — oznacz jako zrobiony"[^>]*style="scroll-margin-top:88px"/)
  })

  it('no longer renders the cooking-mode button (moved to the action row)', () => {
    expect(render(null)).not.toContain('Zacznij gotować')
  })
})

describe('stepProgress', () => {
  it('counts ticked steps and points at the first open one', () => {
    expect(stepProgress(3, [])).toEqual({ done: 0, next: 0 })
    expect(stepProgress(3, [1])).toEqual({ done: 1, next: 0 })
    expect(stepProgress(3, [0])).toEqual({ done: 1, next: 1 })
  })

  it('reports completion with no next step', () => {
    expect(stepProgress(3, [0, 1, 2])).toEqual({ done: 3, next: -1 })
    expect(stepProgress(0, [])).toEqual({ done: 0, next: -1 })
  })

  it('ignores a stale tick past the last step', () => {
    expect(stepProgress(2, [0, 5])).toEqual({ done: 1, next: 1 })
  })
})
