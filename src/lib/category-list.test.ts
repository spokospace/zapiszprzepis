import { describe, expect, it } from 'vitest'
import { clampPage, tagCounts, withTags } from './category-list'

const cards = [
  { id: 1, tags: ['szybkie', 'tanie'] },
  { id: 2, tags: ['szybkie'] },
  { id: 3, tags: null },
  { id: 4, tags: ['tanie', 'wegetarianskie'] },
]

describe('withTags', () => {
  it('keeps every card, in order, when nothing is selected', () => {
    expect(withTags(cards, []).map((c) => c.id)).toEqual([1, 2, 3, 4])
  })

  it('keeps the cards that have every selected tag (AND)', () => {
    expect(withTags(cards, ['szybkie']).map((c) => c.id)).toEqual([1, 2])
    expect(withTags(cards, ['szybkie', 'tanie']).map((c) => c.id)).toEqual([1])
    expect(withTags(cards, ['nieznany'])).toEqual([])
  })
})

describe('tagCounts', () => {
  const asMap = (rows: { tag: string; count: number }[]) => Object.fromEntries(rows.map((r) => [r.tag, r.count]))

  it('counts each tag over the whole category when nothing is selected', () => {
    expect(asMap(tagCounts(cards, []))).toEqual({ szybkie: 2, tanie: 2, wegetarianskie: 1 })
  })

  it('counts only within the selection, like category_tag_facets (tags @> selected)', () => {
    expect(asMap(tagCounts(cards, ['tanie']))).toEqual({ szybkie: 1, tanie: 2, wegetarianskie: 1 })
  })

  it('counts a tag listed twice on one card once', () => {
    expect(tagCounts([{ tags: ['tanie', 'tanie'] }], [])).toEqual([{ tag: 'tanie', count: 1 }])
  })
})

describe('clampPage', () => {
  it('stays between page 1 and the last page', () => {
    expect(clampPage(1, 100)).toBe(1)
    expect(clampPage(5, 100)).toBe(5)
    expect(clampPage(9, 100)).toBe(5)
    expect(clampPage(3, 0)).toBe(1)
  })
})
