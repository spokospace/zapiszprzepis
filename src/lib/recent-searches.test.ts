import { describe, it, expect } from 'vitest'
import { addRecentSearch, parseRecentSearches } from './recent-searches'

describe('recent searches (E01-S26)', () => {
  it('puts the newest query first and keeps at most five', () => {
    const list = ['a', 'b', 'c', 'd', 'e']
    expect(addRecentSearch(list, 'f')).toEqual(['f', 'a', 'b', 'c', 'd'])
  })

  it('moves a repeated query to the front instead of duplicating it, ignoring case', () => {
    expect(addRecentSearch(['dynia', 'Pierogi', 'sernik'], 'pierogi')).toEqual(['pierogi', 'dynia', 'sernik'])
  })

  it('ignores an empty query and trims spaces', () => {
    expect(addRecentSearch(['dynia'], '   ')).toEqual(['dynia'])
    expect(addRecentSearch([], '  rosół ')).toEqual(['rosół'])
  })

  it('reads nothing from missing or malformed storage', () => {
    expect(parseRecentSearches(null)).toEqual([])
    expect(parseRecentSearches('not json')).toEqual([])
    expect(parseRecentSearches('{"a":1}')).toEqual([])
    expect(parseRecentSearches('["dynia", 3, "", "rosół"]')).toEqual(['dynia', 'rosół'])
  })
})
