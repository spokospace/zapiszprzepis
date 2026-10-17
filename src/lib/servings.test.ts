import { describe, it, expect } from 'vitest'
import { jsonLdServings, parseRecipeYield, servingsLabel, toServings } from '@/lib/servings'

describe('servingsLabel', () => {
  it.each([
    [1, 'na 1 porcję'],
    [2, 'na 2 porcje'],
    [3, 'na 3 porcje'],
    [4, 'na 4 porcje'],
    [5, 'na 5 porcji'],
    [6, 'na 6 porcji'],
    [10, 'na 10 porcji'],
    [11, 'na 11 porcji'],
    [12, 'na 12 porcji'],
    [13, 'na 13 porcji'],
    [14, 'na 14 porcji'],
    [15, 'na 15 porcji'],
    [21, 'na 21 porcji'],
    [22, 'na 22 porcje'],
    [24, 'na 24 porcje'],
    [25, 'na 25 porcji'],
    [32, 'na 32 porcje'],
    [99, 'na 99 porcji'],
  ])('%i → %s', (n, label) => {
    expect(servingsLabel(n)).toBe(label)
  })
})

describe('toServings', () => {
  it('accepts an integer 1–99, as a number or a bare numeric string', () => {
    expect(toServings(4)).toBe(4)
    expect(toServings('6')).toBe(6)
    expect(toServings(1)).toBe(1)
    expect(toServings(99)).toBe(99)
  })

  it.each([0, 100, -2, 4.5, '4 porcje', '', null, undefined, Number.NaN, {}])('rejects %p', (value) => {
    expect(toServings(value)).toBeNull()
  })
})

describe('parseRecipeYield', () => {
  it.each([
    [4, 4],
    ['4', 4],
    ['4 porcje', 4],
    ['na 6 porcji', 6],
    ['dla 6 osób', 6],
    ['2 osoby', 2],
    ['Serves 4', 4],
    ['8 servings', 8],
    ['4 portions', 4],
    [['4', '4 porcje'], 4],
    [['1 tortownica', '8 porcji'], 8],
  ])('%p → %p', (value, expected) => {
    expect(parseRecipeYield(value)).toBe(expected)
  })

  it.each([
    ['4–6 porcji'],
    ['4-6 servings'],
    ['24 sztuki'],
    ['1 tortownica 24 cm'],
    ['1 l'],
    ['kilka porcji'],
    ['0'],
    ['120 porcji'],
    [null],
    [undefined],
    [{ value: 4 }],
    [[]],
  ])('%p → null', (value) => {
    expect(parseRecipeYield(value)).toBeNull()
  })
})

describe('jsonLdServings', () => {
  const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`

  it('reads the Recipe node, also inside a @graph and with an array @type', () => {
    expect(jsonLdServings(ld({ '@type': 'Recipe', recipeYield: '4 porcje' }))).toBe(4)
    expect(
      jsonLdServings(ld({ '@graph': [{ '@type': 'WebPage' }, { '@type': ['Recipe', 'HowTo'], recipeYield: ['6'] }] })),
    ).toBe(6)
  })

  it('ignores other nodes, a yield that is no servings count, and malformed blocks', () => {
    expect(jsonLdServings(ld({ '@type': 'Article', recipeYield: '4' }))).toBeNull()
    expect(jsonLdServings(ld({ '@type': 'Recipe', recipeYield: '24 sztuki' }))).toBeNull()
    expect(jsonLdServings('<script type="application/ld+json">{ broken</script>')).toBeNull()
    expect(jsonLdServings('<p>no json-ld</p>')).toBeNull()
  })

  it('takes the first usable block', () => {
    const html = '<script type="application/ld+json">{ broken</script>' + ld({ '@type': 'Recipe', recipeYield: 5 })
    expect(jsonLdServings(html)).toBe(5)
  })
})
