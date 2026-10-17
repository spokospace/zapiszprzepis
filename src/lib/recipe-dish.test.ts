import { describe, it, expect } from 'vitest'
import {
  normalizeDish,
  resolveDishAccusative,
  resolveVariantNote,
  dishVocabularyFor,
  type DishVocabularyEntry,
} from './recipe-dish'

const high = (dish: unknown, dishAccusative: unknown = null) => ({ dish, dishAccusative, confidence: 'high' })

describe('normalizeDish', () => {
  it('keeps a clean lowercase dish', () => {
    expect(normalizeDish(high('sernik'))).toBe('sernik')
    expect(normalizeDish(high('zupa ziemniaczana'))).toBe('zupa ziemniaczana')
  })

  it('lowercases and trims, strips surrounding quotes and trailing punctuation', () => {
    expect(normalizeDish(high('  "Sernik".  '))).toBe('sernik')
    expect(normalizeDish(high('SZARLOTKA'))).toBe('szarlotka')
  })

  it('rejects confidence other than high', () => {
    expect(normalizeDish({ dish: 'sernik', confidence: 'low' })).toBeNull()
    expect(normalizeDish({ dish: 'sernik' })).toBeNull()
  })

  it('rejects a non-string dish, non-object, or null', () => {
    expect(normalizeDish(high(123))).toBeNull()
    expect(normalizeDish(high(null))).toBeNull()
    expect(normalizeDish(null)).toBeNull()
    expect(normalizeDish('sernik')).toBeNull()
  })

  it('rejects out-of-charset values (digits, punctuation)', () => {
    expect(normalizeDish(high('sernik 2'))).toBeNull()
    expect(normalizeDish(high('danie @ obiad'))).toBeNull()
    expect(normalizeDish(high('a/b'))).toBeNull()
  })

  it('enforces length 3–60 and at most 5 words', () => {
    expect(normalizeDish(high('ab'))).toBeNull()
    expect(normalizeDish(high('a'.repeat(61)))).toBeNull()
    expect(normalizeDish(high('jeden dwa trzy cztery pięć sześć'))).toBeNull()
    expect(normalizeDish(high('jeden dwa trzy cztery pięć'))).toBe('jeden dwa trzy cztery pięć')
  })

  it('blocks bare class words and category labels', () => {
    for (const w of ['ciasto', 'zupa', 'sałatka', 'surówka', 'deser', 'danie', 'inne', 'ciasteczka']) {
      expect(normalizeDish(high(w)), w).toBeNull()
    }
    expect(normalizeDish(high('Śniadania'))).toBeNull()
    expect(normalizeDish(high('syropy i napary'))).toBeNull()
  })

  it('blocks diacritic-less spellings of class words too', () => {
    expect(normalizeDish(high('salatka'))).toBeNull()
    expect(normalizeDish(high('napoj'))).toBeNull()
    expect(normalizeDish(high('surowka'))).toBeNull()
  })

  it('snaps to the vocabulary spelling when the folded form matches', () => {
    // A value typed without diacritics takes the existing spelling.
    expect(normalizeDish(high('pierogi ruskie'), ['pieróg', 'pierogi ruśkie'])).toBe('pierogi ruśkie')
    expect(normalizeDish(high('zabkowski'), ['ząbkowski'])).toBe('ząbkowski')
  })

  it('keeps its own spelling when the vocabulary has no folded match', () => {
    expect(normalizeDish(high('sernik'), ['szarlotka'])).toBe('sernik')
  })
})

describe('resolveDishAccusative', () => {
  it('keeps a same-word-count accusative', () => {
    expect(resolveDishAccusative(high('szarlotka', 'szarlotkę'), 'szarlotka')).toBe('szarlotkę')
    expect(resolveDishAccusative(high('zupa ziemniaczana', 'zupę ziemniaczaną'), 'zupa ziemniaczana')).toBe(
      'zupę ziemniaczaną',
    )
  })

  it('allows an accusative equal to the nominative (plural / masculine-inanimate)', () => {
    expect(resolveDishAccusative(high('pierogi', 'pierogi'), 'pierogi')).toBe('pierogi')
  })

  it('returns null when dish is null', () => {
    expect(resolveDishAccusative(high('x', 'szarlotkę'), null)).toBeNull()
  })

  it('returns null on a word-count mismatch', () => {
    expect(resolveDishAccusative(high('szarlotka', 'na szarlotkę'), 'szarlotka')).toBeNull()
  })

  it('returns null for a non-string accusative or over 80 chars', () => {
    expect(resolveDishAccusative(high('szarlotka', 123), 'szarlotka')).toBeNull()
    expect(resolveDishAccusative(high('szarlotka', 'ą'.repeat(81)), 'szarlotka')).toBeNull()
  })
})

describe('resolveVariantNote', () => {
  it('sentence-cases and strips a trailing period', () => {
    expect(resolveVariantNote('na kruchym cieście.', 'szarlotka')).toBe('Na kruchym cieście')
  })

  it('accepts the object shape from writeVariantNote', () => {
    expect(resolveVariantNote({ variantNote: 'z budyniem' }, 'szarlotka')).toBe('Z budyniem')
  })

  it('drops comma-parts that only repeat a dish word', () => {
    // "sernik na zimno" shares the stem with the "na zimno" part, which is dropped.
    expect(resolveVariantNote('Na zimno, z musem truskawkowym', 'sernik na zimno')).toBe('Z musem truskawkowym')
  })

  it('returns null when every part repeats the dish or nothing is left', () => {
    expect(resolveVariantNote('sernik', 'sernik')).toBeNull()
    expect(resolveVariantNote('', 'sernik')).toBeNull()
  })

  it('rejects notes shorter than 3 or longer than 60 chars', () => {
    expect(resolveVariantNote('ab', 'sernik')).toBeNull()
    expect(resolveVariantNote('a b c d '.repeat(10), 'sernik')).toBeNull()
  })

  it('rejects a note equal (case-insensitively) to a sibling note', () => {
    expect(resolveVariantNote('Z budyniem', 'szarlotka', ['z budyniem'])).toBeNull()
    expect(resolveVariantNote('Z budyniem', 'szarlotka', ['Z rodzynkami'])).toBe('Z budyniem')
  })

  it('returns null for a non-string value', () => {
    expect(resolveVariantNote(123, 'sernik')).toBeNull()
    expect(resolveVariantNote(null, 'sernik')).toBeNull()
  })
})

describe('dishVocabularyFor', () => {
  const vocab: DishVocabularyEntry[] = [
    { dish: 'sernik', dishAccusative: 'sernik', recipes: 6 },
    { dish: 'sernik na zimno', dishAccusative: 'sernik na zimno', recipes: 3 },
    { dish: 'szarlotka', dishAccusative: 'szarlotkę', recipes: 7 },
    { dish: 'zupa ziemniaczana', dishAccusative: 'zupę ziemniaczaną', recipes: 2 },
  ]

  it('keeps only entries sharing a title word stem, preserving order', () => {
    const out = dishVocabularyFor('Sernik truskawkowy na zimno', vocab)
    expect(out.map((v) => v.dish)).toEqual(['sernik', 'sernik na zimno'])
  })

  it('returns [] when nothing overlaps', () => {
    expect(dishVocabularyFor('Pierogi ruskie', vocab)).toEqual([])
  })

  it('caps the result at max', () => {
    expect(dishVocabularyFor('Sernik', vocab, 1)).toHaveLength(1)
  })
})
