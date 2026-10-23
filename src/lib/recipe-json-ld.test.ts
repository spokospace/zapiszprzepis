import { describe, it, expect } from 'vitest'
import { buildRecipeJsonLd, serializeJsonLd, type RecipeForJsonLd } from './recipe-json-ld'

const SITE = 'https://zapiszprzepis.pl'

const base: RecipeForJsonLd = {
  slug: 'sernik-krakowski',
  title: 'Sernik krakowski',
  description: 'Klasyczny sernik z kratką.',
  meta_description: 'Najlepszy sernik krakowski z kratką — przepis krok po kroku.',
  image_url: 'https://wvrlgddgdddwmgzbvtij.supabase.co/storage/v1/object/public/recipe-images/u/7/sernik.jpg',
  ingredients: [
    { name: 'twaróg', amount: '1', unit: 'kg' },
    { name: 'cukier', amount: '20', unit: 'dag' },
  ],
  steps: ['Zmiel twaróg.', 'Dodaj cukier i jajka.', 'Piecz 60 minut.'],
  prep_time_minutes: 30,
  cook_time_minutes: 60,
  total_time_minutes: 90,
  servings: 12,
  category: 'desery',
  tags: ['z-twarogiem', 'kruche'],
  source_author: 'Ania Gotuje',
  created_at: '2026-01-02T10:00:00.000Z',
  last_modified: '2026-03-04T12:00:00.000Z',
}

describe('buildRecipeJsonLd', () => {
  it('maps a full recipe to a schema.org Recipe', () => {
    const ld = buildRecipeJsonLd(base, SITE)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Recipe')
    expect(ld.name).toBe('Sernik krakowski')
    expect(ld.url).toBe('https://zapiszprzepis.pl/przepis/sernik-krakowski')
    expect(ld.mainEntityOfPage).toBe('https://zapiszprzepis.pl/przepis/sernik-krakowski')
    expect(ld.inLanguage).toBe('pl-PL')
    expect(ld.description).toBe('Najlepszy sernik krakowski z kratką — przepis krok po kroku.')
    expect(ld.recipeCategory).toBe('Desery')
    expect(ld.datePublished).toBe('2026-01-02T10:00:00.000Z')
    expect(ld.dateModified).toBe('2026-03-04T12:00:00.000Z')
  })

  it('renders times as ISO 8601 durations', () => {
    const ld = buildRecipeJsonLd(base, SITE)
    expect(ld.prepTime).toBe('PT30M')
    expect(ld.cookTime).toBe('PT60M')
    expect(ld.totalTime).toBe('PT90M')
  })

  it('renders servings as a pluralized recipeYield', () => {
    expect(buildRecipeJsonLd(base, SITE).recipeYield).toBe('12 porcji')
    expect(buildRecipeJsonLd({ ...base, servings: 1 }, SITE).recipeYield).toBe('1 porcja')
    expect(buildRecipeJsonLd({ ...base, servings: 2 }, SITE).recipeYield).toBe('2 porcje')
  })

  it('joins ingredients as amount + unit + name', () => {
    expect(buildRecipeJsonLd(base, SITE).recipeIngredient).toEqual(['1 kg twaróg', '20 dag cukier'])
  })

  it('renders each step as a HowToStep', () => {
    expect(buildRecipeJsonLd(base, SITE).recipeInstructions).toEqual([
      { '@type': 'HowToStep', text: 'Zmiel twaróg.' },
      { '@type': 'HowToStep', text: 'Dodaj cukier i jajka.' },
      { '@type': 'HowToStep', text: 'Piecz 60 minut.' },
    ])
  })

  it('maps the original source author to a Person', () => {
    expect(buildRecipeJsonLd(base, SITE).author).toEqual({ '@type': 'Person', name: 'Ania Gotuje' })
  })

  it('maps tags to a keywords string via their labels', () => {
    expect(buildRecipeJsonLd(base, SITE).keywords).toBe('z twarogiem, kruche')
  })

  it('never invents a rating or nutrition', () => {
    const ld = buildRecipeJsonLd(base, SITE)
    expect(ld.aggregateRating).toBeUndefined()
    expect(ld.review).toBeUndefined()
    expect(ld.nutrition).toBeUndefined()
  })

  it('keeps estimated times — they are what the page shows', () => {
    const ld = buildRecipeJsonLd({ ...base, total_time_minutes: 45 }, SITE)
    expect(ld.totalTime).toBe('PT45M')
  })

  it('omits the fields it cannot fill', () => {
    const ld = buildRecipeJsonLd(
      {
        ...base,
        meta_description: null,
        prep_time_minutes: null,
        cook_time_minutes: null,
        total_time_minutes: null,
        servings: null,
        tags: [],
        source_author: null,
      },
      SITE,
    )
    expect(ld.prepTime).toBeUndefined()
    expect(ld.cookTime).toBeUndefined()
    expect(ld.totalTime).toBeUndefined()
    expect(ld.recipeYield).toBeUndefined()
    expect(ld.author).toBeUndefined()
    expect(ld.keywords).toBeUndefined()
    // meta_description absent → a self-derived description is always present.
    expect(typeof ld.description).toBe('string')
    expect((ld.description as string).length).toBeGreaterThan(0)
  })

  it('falls back dateModified to datePublished when last_modified is absent', () => {
    const ld = buildRecipeJsonLd({ ...base, last_modified: null }, SITE)
    expect(ld.dateModified).toBe(base.created_at)
  })

  it('emits only an archived Storage cover as the image, never a legacy external link', () => {
    expect(buildRecipeJsonLd(base, SITE).image).toEqual([base.image_url])
    // A non-archived external cover is not emitted (the image_url invariant keeps
    // third-party hosts out of the markup); null likewise yields no image.
    expect(buildRecipeJsonLd({ ...base, image_url: 'https://cdn.example.com/x.jpg' }, SITE).image).toBeUndefined()
    expect(buildRecipeJsonLd({ ...base, image_url: null }, SITE).image).toBeUndefined()
  })

  it('drops empty ingredient and step lists instead of emitting empty arrays', () => {
    const ld = buildRecipeJsonLd({ ...base, ingredients: [], steps: [] }, SITE)
    expect(ld.recipeIngredient).toBeUndefined()
    expect(ld.recipeInstructions).toBeUndefined()
  })
})

describe('serializeJsonLd', () => {
  const SEP_2028 = String.fromCharCode(0x2028)
  const SEP_2029 = String.fromCharCode(0x2029)

  it('escapes the characters that could break out of a <script> tag', () => {
    const out = serializeJsonLd({ text: 'a </script> b & <x>' })
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(out).not.toContain('&')
    // < > & survive only as their \uXXXX escapes (the "u003c" etc. substrings).
    expect(out).toContain('u003c')
    expect(out).toContain('u003e')
    expect(out).toContain('u0026')
  })

  it('escapes the line/paragraph separators that break inline scripts', () => {
    const out = serializeJsonLd({ text: `a${SEP_2028}b${SEP_2029}c` })
    expect(out).not.toContain(SEP_2028)
    expect(out).not.toContain(SEP_2029)
    expect(out).toContain('u2028')
    expect(out).toContain('u2029')
  })

  it('round-trips to the original object after parsing', () => {
    const data = { '@type': 'Recipe', name: 'Tarta <cytrynowa> & więcej' }
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data)
  })
})
