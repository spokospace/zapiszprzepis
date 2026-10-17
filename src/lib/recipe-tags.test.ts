import { describe, it, expect } from 'vitest'
import {
  MAX_TAGS,
  META_DESCRIPTION_MAX,
  RECIPE_TAGS,
  resolveDescription,
  resolveMetaDescription,
  resolveTags,
  tagLabel,
} from '@/lib/recipe-tags'

describe('resolveTags', () => {
  it('adds the tags the title names outright, whatever the LLM said', () => {
    expect(resolveTags({ title: 'Bardzo kruche ciastka', tags: [] })).toEqual(['kruche'])
    expect(resolveTags({ title: 'Maślane ciasteczka z rowkami' })).toEqual(['maslane'])
    expect(resolveTags({ title: 'Sałatka jarzynowa z majonezem i musztardą' })).toEqual(['majonezowe', 'musztardowe'])
  })

  it('matches Polish word starts that \b would miss', () => {
    expect(resolveTags({ title: 'Ciasto drożdżowe ze śliwkami' })).toEqual(['drozdzowe'])
    expect(resolveTags({ title: 'Pączki z różą' })).toEqual(['tlusty-czwartek'])
    expect(resolveTags({ title: 'Wigilijny barszcz' })).toEqual(['boze-narodzenie'])
  })

  it('reads the leading-ingredient tags added in E01-S16 from the title', () => {
    expect(resolveTags({ title: 'Ciasteczka owsiane z kokosem' })).toEqual(['kokosowe', 'owsiane'])
    expect(resolveTags({ title: 'Makowiec z orzechami' })).toEqual(['orzechowe', 'makowe'])
    expect(resolveTags({ title: 'Tarta cytrynowa' })).toEqual(['cytrynowe'])
    expect(resolveTags({ title: 'Miodownik' })).toEqual(['miodowe'])
    expect(resolveTags({ title: 'Zupa krem z dyni' })).toEqual(['dyniowe'])
    expect(resolveTags({ title: 'Placki ziemniaczane' })).toEqual(['ziemniaczane'])
  })

  it('does not read pasta or mackerel as poppy seed', () => {
    expect(resolveTags({ title: 'Makaron z makrelą' })).toEqual([])
    expect(resolveTags({ title: 'Kluski z makiem' })).toEqual(['makowe'])
  })

  it('does not read buttermilk or a word inside another as a tag', () => {
    expect(resolveTags({ title: 'Placki na maślance' })).toEqual([])
    expect(resolveTags({ title: 'Niekruchy chleb' })).toEqual([])
  })

  it('keeps LLM tags from the closed list only, normalised and deduplicated', () => {
    expect(
      resolveTags({ title: 'Kruche ciastka', tags: ['Kruche', 'czekoladowe', 'z majonezem', 42, 'czekoladowe'] }),
    ).toEqual(['kruche', 'czekoladowe'])
    expect(resolveTags({ title: 'Zupa', tags: 'grill' })).toEqual([])
  })

  it('computes "szybkie" from the times and ignores it from the LLM', () => {
    expect(resolveTags({ title: 'Omlet', totalTimeMinutes: 15 })).toEqual(['szybkie'])
    expect(resolveTags({ title: 'Omlet', prepTimeMinutes: 10, cookTimeMinutes: 10 })).toEqual(['szybkie'])
    expect(resolveTags({ title: 'Omlet', prepTimeMinutes: 10 })).toEqual([])
    expect(resolveTags({ title: 'Bigos', totalTimeMinutes: 180, tags: ['szybkie'] })).toEqual([])
  })

  it('prefers total time, which includes passive time, over prep + cook', () => {
    expect(resolveTags({ title: 'Sernik', prepTimeMinutes: 10, cookTimeMinutes: 10, totalTimeMinutes: 240 })).toEqual([
      'z-twarogiem',
    ])
  })

  it('caps the list without cutting the forced tags', () => {
    const tags = resolveTags({
      title: 'Kruche maślane ciastka',
      totalTimeMinutes: 20,
      tags: ['czekoladowe', 'owocowe', 'impreza', 'dla-dzieci', 'grill'],
    })
    expect(tags).toHaveLength(MAX_TAGS)
    expect(tags.slice(0, 3)).toEqual(['kruche', 'maslane', 'szybkie'])
  })
})

describe('tagLabel', () => {
  it('restores diacritics and falls back to the raw value', () => {
    expect(tagLabel('boze-narodzenie')).toBe('Boże Narodzenie')
    expect(tagLabel('maslane')).toBe('maślane')
    expect(tagLabel('nieznany')).toBe('nieznany')
  })

  it('has unique values', () => {
    expect(new Set(RECIPE_TAGS.map((t) => t.value)).size).toBe(RECIPE_TAGS.length)
  })
})

describe('resolveDescription', () => {
  it('trims whitespace and trailing punctuation', () => {
    expect(resolveDescription('  z rowkami,  na żółtkach. ', 'Maślane ciasteczka')).toBe('z rowkami, na żółtkach')
  })

  it('drops the parts that echo the title, in any inflection', () => {
    expect(resolveDescription('z charakterystycznymi rowkami', 'Ciasteczka maślane z rowkami')).toBeNull()
    expect(resolveDescription('z toffi, na jogurcie', 'Czekoladowe babeczki na jogurcie')).toBe('z toffi')
    expect(resolveDescription('z galaretką truskawkową', 'Truskawkowy sernik na zimno')).toBeNull()
  })

  it('drops empty, non-string and runaway notes', () => {
    expect(resolveDescription('', 'Tiramisu')).toBeNull()
    expect(resolveDescription(null, 'Tiramisu')).toBeNull()
    expect(resolveDescription('x'.repeat(81), 'Tiramisu')).toBeNull()
  })
})

describe('resolveMetaDescription', () => {
  it('keeps a sentence within budget, collapsing whitespace', () => {
    expect(resolveMetaDescription('  Kruche ciastka   maślane z polewą.  ')).toBe('Kruche ciastka maślane z polewą.')
  })

  it('strips a surrounding pair of quotes', () => {
    expect(resolveMetaDescription('„Sernik na zimno z truskawkami"')).toBe('Sernik na zimno z truskawkami')
    expect(resolveMetaDescription('"Prosty przepis"')).toBe('Prosty przepis')
  })

  it('drops empty and non-string input', () => {
    expect(resolveMetaDescription('')).toBeNull()
    expect(resolveMetaDescription('   ')).toBeNull()
    expect(resolveMetaDescription(null)).toBeNull()
    expect(resolveMetaDescription(42)).toBeNull()
  })

  it('truncates on a word boundary with an ellipsis past Google\'s budget', () => {
    const long = `${'słowo '.repeat(40)}koniec`
    const out = resolveMetaDescription(long)!
    expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX)
    expect(out.endsWith('…')).toBe(true)
    // Cut on a boundary: no dangling partial word before the ellipsis.
    expect(out).not.toMatch(/sło…$/)
    expect(out.slice(0, -1).trim().endsWith('słowo')).toBe(true)
  })
})
