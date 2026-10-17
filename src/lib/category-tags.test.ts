import { describe, it, expect } from 'vitest'
import {
  joinWithAnd,
  parsePageParam,
  parseTagParam,
  rankSimilar,
  sharedTagsCaption,
  categoryNoun,
  similarHeading,
  tagFacets,
  tagSummary,
} from '@/lib/category-tags'

describe('joinWithAnd', () => {
  it('joins with commas and a final "i"', () => {
    expect(joinWithAnd([])).toBe('')
    expect(joinWithAnd(['kruche'])).toBe('kruche')
    expect(joinWithAnd(['kruche', 'maślane'])).toBe('kruche i maślane')
    expect(joinWithAnd(['a', 'b', 'c'])).toBe('a, b i c')
  })
})

describe('tagSummary (E01-S22)', () => {
  it('reads "N przepisy: tag i tag" with the Polish plural', () => {
    expect(tagSummary(3, ['kruche', 'maslane'])).toBe('3 przepisy: kruche i maślane')
    expect(tagSummary(1, ['kruche'])).toBe('1 przepis: kruche')
    expect(tagSummary(5, ['kruche'])).toBe('5 przepisów: kruche')
  })
})

describe('sharedTagsCaption', () => {
  it('lists the shared tags in the recipe’s order', () => {
    expect(sharedTagsCaption(['kruche', 'maslane'], ['maslane', 'kruche', 'owocowe'])).toBe('też kruche i maślane')
  })

  it('is null when nothing is shared', () => {
    expect(sharedTagsCaption(['kruche'], ['owocowe'])).toBeNull()
    expect(sharedTagsCaption(['kruche'], null)).toBeNull()
  })
})

describe('similarHeading', () => {
  it('names the tag most similar recipes share', () => {
    const similar = [{ tags: ['maslane'] }, { tags: ['maslane', 'kruche'] }, { tags: null }]
    expect(similarHeading(['kruche', 'maslane'], similar, 'Ciasteczka')).toBe('Podobne: maślane ciasteczka')
  })

  it('breaks a tie by the recipe’s own tag order', () => {
    expect(similarHeading(['kruche', 'maslane'], [{ tags: ['maslane', 'kruche'] }], 'Ciasteczka')).toBe(
      'Podobne: kruche ciasteczka',
    )
  })

  it('skips capitalised tags and falls back to the category alone', () => {
    expect(similarHeading(['wielkanoc'], [{ tags: ['wielkanoc'] }], 'Ciasta')).toBe('Podobne: ciasta')
    expect(similarHeading(['kruche'], [{ tags: ['owocowe'] }], 'Ciasta')).toBe('Podobne: ciasta')
  })

  it('puts a phrase tag after the category and skips noun tags', () => {
    expect(similarHeading(['na-zimno'], [{ tags: ['na-zimno'] }], 'Zupy')).toBe('Podobne: zupy na zimno')
    expect(similarHeading(['dla-dzieci'], [{ tags: ['dla-dzieci'] }], 'Obiady')).toBe('Podobne: obiady dla dzieci')
    expect(similarHeading(['grill', 'impreza'], [{ tags: ['grill', 'impreza'] }], 'Obiady')).toBe('Podobne: obiady')
  })

  it('reads "przepisy" for the Inne category', () => {
    expect(similarHeading(['szybkie'], [{ tags: ['szybkie'] }], 'Inne')).toBe('Podobne: szybkie przepisy')
    expect(categoryNoun('Inne')).toBe('przepisy')
    expect(categoryNoun('Syropy i napary')).toBe('syropy i napary')
  })
})

describe('parseTagParam', () => {
  it('reads comma-separated and repeated params, closed list only, deduplicated', () => {
    expect(parseTagParam('kruche,czekoladowe')).toEqual(['kruche', 'czekoladowe'])
    expect(parseTagParam(['kruche', 'owocowe,kruche'])).toEqual(['kruche', 'owocowe'])
    expect(parseTagParam(' Kruche , xyz,,')).toEqual(['kruche'])
  })

  it('is empty for a missing or fully invalid param', () => {
    expect(parseTagParam(undefined)).toEqual([])
    expect(parseTagParam('xyz,<script>')).toEqual([])
  })

  it('keeps at most six tags, since a recipe never carries more', () => {
    expect(
      parseTagParam('kruche,maslane,drozdzowe,biszkoptowe,francuskie,owocowe,czekoladowe'),
    ).toHaveLength(6)
  })
})

describe('parsePageParam', () => {
  it('accepts whole numbers from 1, anything else is page 1', () => {
    expect(parsePageParam('3')).toBe(3)
    expect(parsePageParam(['2', '5'])).toBe(2)
    for (const bad of [undefined, '', '0', '-1', '2.5', 'abc', '99999']) expect(parsePageParam(bad)).toBe(1)
  })
})

describe('tagFacets', () => {
  const rows = [
    { tags: ['kruche', 'czekoladowe'] },
    { tags: ['kruche', 'czekoladowe', 'maslane'] },
    { tags: ['kruche', 'owocowe'] },
    { tags: ['owocowe'] },
    { tags: null },
  ]

  it('counts every tag over the whole category when nothing is selected', () => {
    expect(tagFacets(rows, []).map((f) => [f.value, f.count])).toEqual([
      ['kruche', 3],
      ['czekoladowe', 2],
      ['owocowe', 2],
      ['maslane', 1],
    ])
  })

  it('counts within the AND selection, puts selected first and hides dead ends', () => {
    const facets = tagFacets(rows, ['kruche'])
    expect(facets.map((f) => [f.value, f.count, f.selected])).toEqual([
      ['kruche', 3, true],
      ['czekoladowe', 2, false],
      ['maslane', 1, false],
      ['owocowe', 1, false],
    ])
  })

  it('keeps a selected tag with no results so it can be removed', () => {
    expect(tagFacets(rows, ['grill'])).toEqual([{ value: 'grill', label: 'grill', count: 0, selected: true }])
  })
})

describe('rankSimilar', () => {
  const r = (id: number, tags: string[] | null) => ({ id, tags })

  it('ranks by shared tags, newest first within a tie', () => {
    const candidates = [r(1, ['kruche']), r(2, ['kruche', 'czekoladowe']), r(3, ['czekoladowe']), r(4, ['owocowe'])]
    expect(rankSimilar(['kruche', 'czekoladowe'], candidates, []).map((x) => x.id)).toEqual([2, 1, 3])
  })

  it('tops up from the newest in the category without repeating a recipe', () => {
    const fill = [r(2, []), r(9, null), r(8, [])]
    expect(rankSimilar(['kruche'], [r(2, ['kruche'])], fill).map((x) => x.id)).toEqual([2, 9, 8])
  })

  it('falls back to the newest for a recipe without tags, capped at the limit', () => {
    const fill = [r(5, []), r(6, []), r(7, []), r(8, []), r(9, [])]
    expect(rankSimilar([], [], fill).map((x) => x.id)).toEqual([5, 6, 7, 8])
  })
})
