import { describe, it, expect } from 'vitest'
import { parseIngredients, groupBySection } from '@/lib/ingredients'

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
