import { describe, it, expect } from 'vitest'
import { findGlossaryTerms, GLOSSARY_ENTRIES } from './ingredient-glossary'

const terms = (...texts: (string | null | undefined)[]) => findGlossaryTerms(texts).map((e) => e.term)

describe('findGlossaryTerms (#544)', () => {
  it('finds a term in the title, whatever its case', () => {
    expect(terms('Domowe SpaghettiOs z chrupiącym serem Manchego')).toEqual(['manchego'])
  })

  it('matches Polish inflected forms', () => {
    expect(terms('Dodaj burratę i pokrój pancettę')).toEqual(['burrata', 'pancetta'])
    expect(terms('Podawać z burratą')).toEqual(['burrata'])
    expect(terms('ser ricotta, 200 g ricotty')).toEqual(['ricotta'])
    expect(terms('Zrób beszamel z masła i mleka.')).toEqual(['beszamel'])
  })

  it('folds diacritics in foreign names', () => {
    expect(terms('2 łyżki crème fraîche')).toEqual(['crème fraîche'])
    expect(terms('starty Gruyère')).toEqual(['gruyère'])
    expect(terms('Za’atar do posypania')).toEqual(['zaatar'])
  })

  it('lists each term once, in the order the recipe first mentions it', () => {
    expect(terms('Makaron z guanciale', 'pecorino', 'Wymieszaj guanciale z pecorino i podaj z aioli.')).toEqual([
      'guanciale',
      'pecorino',
      'aioli',
    ])
  })

  it('matches whole words only', () => {
    // „orzo” inside „orzechy”, „miso” inside „misobox”, „nori” inside „Nórinka”.
    expect(terms('posiekane orzechy', 'misobox', 'tamaryndowiec')).toEqual([])
  })

  it('tells serrano ham from serrano peppers', () => {
    expect(terms('100 g szynki serrano')).toEqual(['szynka serrano'])
    expect(terms('papryczka serrano')).toEqual([])
  })

  it('renders nothing for a recipe without glossary terms', () => {
    expect(terms('Rosół z makaronem', 'marchew', 'pietruszka', 'Gotuj 2 godziny.')).toEqual([])
    expect(terms(null, undefined, '')).toEqual([])
  })

  it('keeps every entry to a single short explanation', () => {
    expect(GLOSSARY_ENTRIES.length).toBeGreaterThanOrEqual(50)
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.explanation.length, entry.term).toBeLessThanOrEqual(160)
      expect(entry.explanation, entry.term).toMatch(/\.$/)
    }
  })

  it('has unique terms', () => {
    const all = GLOSSARY_ENTRIES.map((e) => e.term)
    expect(new Set(all).size).toBe(all.length)
  })
})
