import { describe, it, expect } from 'vitest'
import {
  ingredientKey,
  ingredientDiff,
  versionBadges,
  versionsBarLabel,
  versionsHeading,
  sortVersions,
  parseVersionsSort,
  dishExclusionFilter,
  type DishVersionRow,
} from './dish-versions'

describe('ingredientKey', () => {
  it('drops units, quantities and brackets, keying on the ingredient word', () => {
    expect([...ingredientKey('200 g mąki (typ 450)')]).toEqual([...ingredientKey('mąki')])
  })

  it('collapses egg synonyms to one key', () => {
    expect([...ingredientKey('3 jajka')]).toEqual(['jaj'])
    expect([...ingredientKey('jaja')]).toEqual(['jaj'])
  })

  it('returns an empty set for an ingredient that is only filler / units', () => {
    expect(ingredientKey('2 łyżki').size).toBe(0)
    expect(ingredientKey('szczypta').size).toBe(0)
  })

  it('gives the inflected forms of a word one key', () => {
    const same = (a: string, b: string) => expect([...ingredientKey(a)]).toEqual([...ingredientKey(b)])
    same('ogórki konserwowe', 'Ogórek konserwowy')
    same('piersi', 'pierś')
    same('oleju', 'olej')
    same('mąki', 'mąka')
    same('szczypta soli', 'sól')
    same('cukru', 'cukier')
    same('pęczek natki', 'natka')
  })

  it('keeps a word that only starts like a unit ("szczypiorek" is not "szczypta")', () => {
    expect([...ingredientKey('szczypiorek')]).toEqual([...ingredientKey('pęczek szczypiorku')])
    expect(ingredientKey('szczypiorek').size).toBe(1)
  })
})

describe('ingredientDiff', () => {
  const cur = [{ name: 'mąka' }, { name: 'masło' }, { name: 'drożdże' }]
  const other = [{ name: 'mąka pszenna' }, { name: 'mak' }, { name: 'miód' }, { name: 'rodzynki' }]

  it('lists what the version adds (plus) and what it drops (minus)', () => {
    const { plus, minus } = ingredientDiff(cur, other)
    expect(plus).toEqual(['mak', 'miód', 'rodzynki']) // "mąka pszenna" matches current "mąka"
    expect(minus).toEqual(['masło', 'drożdże'])
  })

  it('matches "mąka" with "mąka pszenna" but not "mąka pszenna" with "mąka ziemniaczana"', () => {
    // Containment: plain "mąka" ⊆ "mąka pszenna" → the same ingredient.
    expect(ingredientDiff([{ name: 'mąka' }], [{ name: 'mąka pszenna' }]).plus).toEqual([])
    // Two qualified flours share only "mąka", neither contains the other → distinct.
    expect(ingredientDiff([{ name: 'mąka pszenna' }], [{ name: 'mąka ziemniaczana' }]).plus).toEqual(['mąka ziemniaczana'])
  })

  it('caps each line at 4 names', () => {
    const many = ['mąka', 'cukier', 'masło', 'jajka', 'mleko', 'drożdże'].map((name) => ({ name }))
    expect(ingredientDiff([], many).plus).toHaveLength(4)
  })

  it('does not treat a shared short-named ingredient as a difference', () => {
    // 3-letter names ("sól", "ser") are keyed like any other: identical ones
    // match, not show as + jest / − nie ma.
    const diff = ingredientDiff([{ name: 'sól' }, { name: 'ser' }], [{ name: 'sól' }, { name: 'mleko' }])
    expect(diff.plus).toEqual(['mleko'])
    expect(diff.minus).toEqual(['ser'])
    // Different short names stay distinct.
    expect(ingredientDiff([{ name: 'sól' }], [{ name: 'ryż' }]).plus).toEqual(['ryż'])
  })

  it('flattens sections and tolerates malformed input', () => {
    const sectioned = [{ name: 'mąka', section: 'Ciasto' }, { name: 'ser', section: 'Masa' }]
    expect(ingredientDiff([{ name: 'mąka' }], sectioned).plus).toEqual(['ser'])
    expect(ingredientDiff('not json', 'also not')).toEqual({ plus: [], minus: [] })
    expect(ingredientDiff([null, { name: 5 }, { name: 'mąka' }], [])).toEqual({ plus: [], minus: ['mąka'] })
  })

  // Production: "nie ma: woda, woda", "majeranek, granulowany czosnek, majeranek, granulowany czosnek".
  it('lists an ingredient a recipe repeats across its sections once', () => {
    const current = [
      { name: 'woda', section: 'Zaczyn' },
      { name: 'drożdże świeże', section: 'Zaczyn' },
      { name: 'mąka', section: 'Ciasto' },
      { name: 'woda', section: 'Ciasto' },
      { name: 'drożdże świeże', section: 'Ciasto' },
      { name: 'drożdże', section: 'Ciasto' },
    ]
    expect(ingredientDiff(current, [{ name: 'mąka' }]).minus).toEqual(['woda', 'drożdże świeże'])
    expect(ingredientDiff([{ name: 'mąka' }], current).plus).toEqual(['woda', 'drożdże świeże'])
  })

  it('collapses repeats before the cap, so the line still names 4 different ingredients', () => {
    const current = ['masło', 'masło', 'cukier', 'cukier', 'jajka', 'mleko', 'kakao'].map((name) => ({ name }))
    expect(ingredientDiff(current, []).minus).toEqual(['masło', 'cukier', 'jajka', 'mleko'])
  })

  // Production: "+ jest: ogórki konserwowe" next to "− nie ma: Ogórek konserwowy".
  it('never lists one ingredient under both + jest and − nie ma for a different word form or a filler word', () => {
    const pairs: [string, string][] = [
      ['ogórki konserwowe', 'Ogórek konserwowy'],
      ['filet z piersi kurczaka', 'pierś z kurczaka'],
      ['olej', 'oleju'],
      ['pieprz czarny', 'świeżo mielony pieprz'],
      ['zimna woda', 'ciepła woda'],
      ['ser', 'ser żółty'],
      ['liść laurowy', 'liście laurowe'],
      ['ocet jabłkowy', 'octu'],
    ]
    for (const [a, b] of pairs) expect(ingredientDiff([{ name: a }], [{ name: b }]), `${a} / ${b}`).toEqual({ plus: [], minus: [] })
  })

  it('keeps different ingredients that share a word apart', () => {
    expect(ingredientDiff([{ name: 'papryka czerwona' }], [{ name: 'słodka papryka w proszku' }])).toEqual({
      plus: ['słodka papryka w proszku'],
      minus: ['papryka czerwona'],
    })
    expect(ingredientDiff([{ name: 'pierś z kurczaka' }], [{ name: 'przyprawa do kurczaka' }]).plus).toEqual(['przyprawa do kurczaka'])
    expect(ingredientDiff([{ name: 'mąka pszenna' }], [{ name: 'mąka kukurydziana' }]).plus).toEqual(['mąka kukurydziana'])
  })

  it('shows a name as it reads mid-sentence', () => {
    const shown = (name: string) => ingredientDiff([], [{ name }]).plus[0]
    expect(shown('Mleko')).toBe('mleko')
    expect(shown('BBQ sos')).toBe('BBQ sos')
    expect(shown('Sos adżika (opcjonalnie)')).toBe('sos adżika')
    expect(shown('zielony, mrożony groszek')).toBe('zielony mrożony groszek')
    expect(shown('przyprawy: sól, pieprz, majeranek')).toBe('przyprawy')
  })
})

const row = (p: Partial<DishVersionRow> = {}): DishVersionRow => ({
  id: 1,
  slug: 's',
  title: 'T',
  image_url: null,
  source_type: 'web_blog',
  source_url: null,
  source_author: null,
  variant_note: null,
  servings: null,
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  times_estimated: false,
  ingredients: [],
  created_at: '2026-01-01T00:00:00Z',
  favorites_count: 0,
  total_count: 1,
  ...p,
})

describe('versionBadges', () => {
  const none = { servings: null, prep_time_minutes: null, cook_time_minutes: null, total_time_minutes: null, times_estimated: false }

  it('omits servings when the version has none', () => {
    expect(versionBadges({ ...none, servings: 8 }, none).servings).toBeNull()
  })

  it('shows servings with no comparison when the current recipe has none', () => {
    expect(versionBadges(none, { ...none, servings: 8 }).servings).toBe('8 porcji')
  })

  it('shows the servings delta both ways', () => {
    expect(versionBadges({ ...none, servings: 12 }, { ...none, servings: 8 }).servings).toBe('8 porcji (o 4 mniej)')
    expect(versionBadges({ ...none, servings: 4 }, { ...none, servings: 8 }).servings).toBe('8 porcji (o 4 więcej)')
    expect(versionBadges({ ...none, servings: 8 }, { ...none, servings: 8 }).servings).toBe('8 porcji')
  })

  it('formats the time and marks (krócej)/(dłużej) only past a 10-minute gap', () => {
    expect(versionBadges({ ...none, total_time_minutes: 60 }, { ...none, total_time_minutes: 90 }).time).toBe('1 godz 30 min (dłużej)')
    expect(versionBadges({ ...none, total_time_minutes: 90 }, { ...none, total_time_minutes: 60 }).time).toBe('1 godz (krócej)')
    // 5-minute gap: no suffix.
    expect(versionBadges({ ...none, total_time_minutes: 60 }, { ...none, total_time_minutes: 65 }).time).toBe('1 godz 5 min')
  })

  it('prefixes an estimated time with "≈" and uses prep+cook when no total', () => {
    expect(versionBadges(none, { ...none, prep_time_minutes: 10, cook_time_minutes: 20, times_estimated: true }).time).toBe('≈ 30 min')
  })

  it('omits the time badge when unknown', () => {
    expect(versionBadges(none, none).time).toBeNull()
  })
})

describe('versionsBarLabel & versionsHeading', () => {
  it('uses the accusative and Polish plurals', () => {
    expect(versionsBarLabel(1, 'szarlotkę')).toBe('Mamy jeszcze 1 inny przepis na szarlotkę')
    expect(versionsBarLabel(3, 'szarlotkę')).toBe('Mamy jeszcze 3 inne przepisy na szarlotkę')
    expect(versionsBarLabel(5, 'szarlotkę')).toBe('Mamy jeszcze 5 innych przepisów na szarlotkę')
    expect(versionsBarLabel(13, 'szarlotkę')).toBe('Mamy jeszcze 13 innych przepisów na szarlotkę')
    expect(versionsBarLabel(22, 'szarlotkę')).toBe('Mamy jeszcze 22 inne przepisy na szarlotkę')
  })

  it('falls back to "na to danie" without an accusative, keeping the plural rules', () => {
    expect(versionsBarLabel(1, null)).toBe('Mamy jeszcze 1 inny przepis na to danie')
    expect(versionsBarLabel(5, null)).toBe('Mamy jeszcze 5 innych przepisów na to danie')
  })

  it('headings use the accusative or the case-free fallback', () => {
    expect(versionsHeading(3, 'szarlotkę')).toBe('Inne przepisy na szarlotkę (3)')
    expect(versionsHeading(3, null)).toBe('Inne wersje tego dania (3)')
  })
})

describe('dishExclusionFilter', () => {
  it('builds the or() filter keeping null-dish rows, only when a dish is given', () => {
    expect(dishExclusionFilter('sernik na zimno')).toBe('dish.is.null,dish.neq."sernik na zimno"')
    expect(dishExclusionFilter(null)).toBeNull()
    expect(dishExclusionFilter(undefined)).toBeNull()
  })

  it('returns null for a dish outside the safe charset (defends the embedded value)', () => {
    expect(dishExclusionFilter('sernik"')).toBeNull()
    expect(dishExclusionFilter('a,b')).toBeNull()
    expect(dishExclusionFilter('x)')).toBeNull()
  })
})

describe('parseVersionsSort', () => {
  it('whitelists the three keys, defaulting to popularne', () => {
    expect(parseVersionsSort('nowe')).toBe('nowe')
    expect(parseVersionsSort('szybkie')).toBe('szybkie')
    expect(parseVersionsSort('popularne')).toBe('popularne')
    expect(parseVersionsSort('bogus')).toBe('popularne')
    expect(parseVersionsSort(undefined)).toBe('popularne')
  })
})

describe('sortVersions', () => {
  const a = row({ id: 1, favorites_count: 2, created_at: '2026-01-01T00:00:00Z', total_time_minutes: 60 })
  const b = row({ id: 2, favorites_count: 5, created_at: '2026-02-01T00:00:00Z', total_time_minutes: 30 })
  const c = row({ id: 3, favorites_count: 5, created_at: '2026-03-01T00:00:00Z', total_time_minutes: null })

  it('popularne: favorites desc, ties by recency', () => {
    expect(sortVersions([a, b, c], 'popularne').map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('nowe: newest first', () => {
    expect(sortVersions([a, b, c], 'nowe').map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('szybkie: quickest first, unknown time last', () => {
    expect(sortVersions([a, b, c], 'szybkie').map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('does not mutate the input', () => {
    const input = [a, b, c]
    sortVersions(input, 'nowe')
    expect(input.map((r) => r.id)).toEqual([1, 2, 3])
  })
})
