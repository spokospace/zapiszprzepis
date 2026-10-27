import { describe, it, expect } from 'vitest'
import { parseIngredients, groupBySection, ingredientLine, householdMeasure } from '@/lib/ingredients'

describe('ingredientLine', () => {
  it('joins amount, unit and name, dropping empty parts', () => {
    expect(ingredientLine({ amount: '2', unit: 'szklanki', name: 'mąki' })).toBe('2 szklanki mąki')
    expect(ingredientLine({ name: 'sól' })).toBe('sól')
  })

  it('leaves the household measure off by default (JSON-LD quantity stays clean)', () => {
    expect(ingredientLine({ amount: '150', unit: 'g', name: 'masła', alt: '3/4 kostki' })).toBe('150 g masła')
  })

  it('appends the household measure in parentheses when opts.alt is set (#505)', () => {
    expect(ingredientLine({ amount: '150', unit: 'g', name: 'masła', alt: '3/4 kostki' }, { alt: true })).toBe('150 g masła (3/4 kostki)')
    // No alt stored → no parentheses even when opted in.
    expect(ingredientLine({ amount: '4', name: 'jajka' }, { alt: true })).toBe('4 jajka')
  })

  it('appends a derived measure for a volume amount with no stated alt (#505)', () => {
    expect(ingredientLine({ amount: '250', unit: 'ml', name: 'mleka' }, { alt: true })).toBe('250 ml mleka (1 szklanka)')
  })
})

describe('householdMeasure', () => {
  it('returns the source-stated measure when present (it always wins)', () => {
    expect(householdMeasure({ amount: '150', unit: 'g', alt: '3/4 kostki' })).toBe('3/4 kostki')
    // Even when a volume amount could be derived, the stated measure wins.
    expect(householdMeasure({ amount: '250', unit: 'ml', alt: 'szklanka z czubem' })).toBe('szklanka z czubem')
  })

  it('derives from a volume amount when nothing is stated', () => {
    expect(householdMeasure({ amount: '180', unit: 'ml' })).toBe('ok. 3/4 szklanki')
  })

  it('derives from a weight staple when nothing is stated and no volume applies (#510)', () => {
    expect(householdMeasure({ amount: '130', unit: 'g', name: 'mąki pszennej' })).toBe('ok. 1 szklanka')
    expect(householdMeasure({ amount: '200', unit: 'g', name: 'masła' })).toBe('1 kostka')
  })

  it('keeps the weight table below the source-stated and volume measures (#510)', () => {
    // A source-stated measure wins over a weight staple.
    expect(householdMeasure({ amount: '130', unit: 'g', name: 'mąki', alt: '1 szklanka z czubem' })).toBe(
      '1 szklanka z czubem',
    )
    // A volume amount is still derived; the weight table only runs when volume yields nothing.
    expect(householdMeasure({ amount: '250', unit: 'ml', name: 'mąki' })).toBe('1 szklanka')
  })

  it('shows a mixed fraction as a decimal, stated or derived (#535)', () => {
    expect(householdMeasure({ amount: '500', unit: 'ml', alt: '2 1/2 szklanki' })).toBe('2,5 szklanki')
    expect(householdMeasure({ amount: '375', unit: 'ml' })).toBe('1,5 szklanki')
    expect(householdMeasure({ amount: '300', unit: 'g', name: 'masła' })).toBe('1,5 kostki')
    expect(ingredientLine({ amount: '500', unit: 'ml', name: 'mleka', alt: '2 1/2 szklanki' }, { alt: true })).toBe(
      '500 ml mleka (2,5 szklanki)',
    )
  })

  it('is null for a weight amount with no matching staple, or when nothing applies', () => {
    expect(householdMeasure({ amount: '300', unit: 'g', name: 'startej marchewki' })).toBeNull()
    expect(householdMeasure({ amount: '50', unit: 'g', name: 'orzechów włoskich' })).toBeNull()
    expect(householdMeasure({ name: 'sól' })).toBeNull()
  })
})

// Risk 4 — ingredient mis-parse / jsonb shape drift. parseIngredients must never
// throw (RSC crash); groupBySection reproduces the prior contiguous grouping.

describe('parseIngredients', () => {
  it('returns an array value unchanged', () => {
    const arr = [{ name: 'Mąka', amount: '2', unit: 'szklanki' }]
    expect(parseIngredients(arr)).toEqual(arr)
  })

  it('parses a valid JSON-array string', () => {
    expect(parseIngredients('[{"name":"Mąka"}]')).toEqual([{ name: 'Mąka' }])
  })

  it('returns [] for malformed/unexpected input (never throws)', () => {
    expect(parseIngredients('Mąka, cukier')).toEqual([]) // non-JSON string
    expect(parseIngredients('{"name":"Mąka"}')).toEqual([]) // JSON object, not array
    expect(parseIngredients(null)).toEqual([])
    expect(parseIngredients(undefined)).toEqual([])
    expect(parseIngredients({ name: 'Mąka' })).toEqual([]) // object, not array
    expect(parseIngredients(42)).toEqual([])
  })
})

describe('groupBySection', () => {
  it('collapses a flat list into one unlabeled group', () => {
    const groups = groupBySection([{ name: 'Mąka' }, { name: 'Cukier' }])
    expect(groups).toEqual([{ section: '', items: [{ name: 'Mąka' }, { name: 'Cukier' }] }])
  })

  it('groups contiguous sections, trimming whitespace and tolerating null', () => {
    const groups = groupBySection([
      { name: 'a', section: ' Krem ' },
      { name: 'b', section: 'Krem' },
      { name: 'c', section: null as unknown as string },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({ section: 'Krem', items: [{ name: 'a', section: ' Krem ' }, { name: 'b', section: 'Krem' }] })
    expect(groups[1].section).toBe('')
  })

  it('PINNED: interleaved sections (A,B,A) produce three groups, not two', () => {
    const groups = groupBySection([
      { name: 'a', section: 'A' },
      { name: 'b', section: 'B' },
      { name: 'c', section: 'A' },
    ])
    expect(groups.map((g) => g.section)).toEqual(['A', 'B', 'A'])
  })

  it('preserves an element with a missing name (does not drop it)', () => {
    const groups = groupBySection([{ amount: '2', unit: 'szklanki' }])
    expect(groups).toEqual([{ section: '', items: [{ amount: '2', unit: 'szklanki' }] }])
  })

  it('returns [] for an empty list', () => {
    expect(groupBySection([])).toEqual([])
  })
})
