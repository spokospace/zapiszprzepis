import { describe, it, expect } from 'vitest'
import {
  MAX_PROFILE_PAGE,
  PROFILE_PAGE_SIZE,
  categoryCounts,
  isProfileOwner,
  isUsernameShape,
  memberSinceLabel,
  oldestCreatedAt,
  parseProfileCategory,
  parseProfilePage,
  profileCategoryHref,
  profileMoreHref,
  profileRobots,
} from './public-profile'

describe('isUsernameShape', () => {
  it('accepts generated usernames', () => {
    expect(isUsernameShape('tola')).toBe(true)
    expect(isUsernameShape('uzytkownik-4')).toBe(true)
    expect(isUsernameShape('anna-maria-2')).toBe(true)
  })

  it('rejects anything the generator cannot produce', () => {
    for (const bad of ['', 'Tola', 'a b', 'a/b', 'a\u0000', '-tola', 'tola-', 'a--b', 'łucja', 'x'.repeat(65)]) {
      expect(isUsernameShape(bad)).toBe(false)
    }
  })
})

describe('parseProfilePage', () => {
  it('parses a positive integer', () => {
    expect(parseProfilePage('3')).toBe(3)
  })

  it('falls back to 1 for missing or garbage values', () => {
    for (const raw of [undefined, '', '0', '-2', '2.5', 'abc', ['2']]) {
      expect(parseProfilePage(raw)).toBe(1)
    }
  })

  it('clamps huge pages', () => {
    expect(parseProfilePage('9999')).toBe(MAX_PROFILE_PAGE)
  })

  it('caps at the deepest page one PostgREST response (1000 rows) can fill, plus the look-ahead row', () => {
    expect(MAX_PROFILE_PAGE * PROFILE_PAGE_SIZE + 1).toBeLessThanOrEqual(1000)
    expect((MAX_PROFILE_PAGE + 1) * PROFILE_PAGE_SIZE + 1).toBeGreaterThan(1000)
    // The biggest profile (~670 recipes) must be reachable to its last card.
    expect(MAX_PROFILE_PAGE * PROFILE_PAGE_SIZE).toBeGreaterThan(670)
  })
})

describe('categoryCounts', () => {
  it('counts per category in RECIPE_CATEGORIES order, dropping unknown and null', () => {
    const rows = [{ category: 'ciasta' }, { category: 'obiady' }, { category: 'ciasta' }, { category: 'kolacje' }, { category: null }]
    expect(categoryCounts(rows)).toEqual([
      { value: 'obiady', label: 'Obiady', count: 1 },
      { value: 'ciasta', label: 'Ciasta', count: 2 },
    ])
  })

  it('is empty without rows', () => {
    expect(categoryCounts([])).toEqual([])
  })
})

describe('parseProfileCategory', () => {
  const available = categoryCounts([{ category: 'ciasta' }])

  it('keeps a category the person has recipes in', () => {
    expect(parseProfileCategory('ciasta', available)).toBe('ciasta')
  })

  it('ignores unknown, empty-for-this-person and non-string values', () => {
    expect(parseProfileCategory('zupy', available)).toBeNull()
    expect(parseProfileCategory('kolacje', available)).toBeNull()
    expect(parseProfileCategory(['ciasta'], available)).toBeNull()
    expect(parseProfileCategory(undefined, available)).toBeNull()
  })
})

describe('memberSinceLabel', () => {
  it('uses the genitive month for every month', () => {
    const expected = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
    expected.forEach((month, i) => {
      const iso = `2026-${String(i + 1).padStart(2, '0')}-15T12:00:00Z`
      expect(memberSinceLabel(iso)).toBe(`${month} 2026`)
    })
  })

  it('takes the earlier of the profile and the oldest recipe', () => {
    expect(memberSinceLabel('2026-10-16T13:46:41Z', '2026-06-12T16:39:42Z')).toBe('czerwca 2026')
    expect(memberSinceLabel('2026-10-16T13:46:41Z', '2026-11-01T10:00:00Z')).toBe('października 2026')
    expect(memberSinceLabel('2026-10-16T13:46:41Z', null)).toBe('października 2026')
  })

  it('reads the month in Polish time, not UTC', () => {
    // 23:30 UTC on 31 October is already 1 November in Warsaw (UTC+1 in winter).
    expect(memberSinceLabel('2026-10-31T23:30:00Z')).toBe('listopada 2026')
  })
})

describe('oldestCreatedAt', () => {
  it('returns the minimum timestamp or null', () => {
    expect(oldestCreatedAt([])).toBeNull()
    expect(oldestCreatedAt([{ created_at: '2026-10-16T21:40:36Z' }, { created_at: '2026-06-12T16:39:42Z' }])).toBe(
      '2026-06-12T16:39:42Z',
    )
  })
})

describe('profile links', () => {
  it('builds the category chip links', () => {
    expect(profileCategoryHref('tola', null)).toBe('/u/tola')
    expect(profileCategoryHref('tola', 'ciasta')).toBe('/u/tola?kategoria=ciasta')
  })

  it('builds "Pokaż kolejne" keeping the category and jumping to the new cards', () => {
    expect(profileMoreHref('tola', null, 2)).toBe('/u/tola?strona=2#wiecej')
    expect(profileMoreHref('tola', 'obiady', 3)).toBe('/u/tola?kategoria=obiady&strona=3#wiecej')
  })
})

describe('isProfileOwner', () => {
  it('is true only for the signed-in owner', () => {
    expect(isProfileOwner('u1', 'u1')).toBe(true)
    expect(isProfileOwner('u2', 'u1')).toBe(false)
    expect(isProfileOwner(null, 'u1')).toBe(false)
    expect(isProfileOwner(undefined, 'u1')).toBe(false)
  })
})

describe('profileRobots', () => {
  it('is noindex only for an empty profile', () => {
    expect(profileRobots(0)).toEqual({ index: false })
    expect(profileRobots(1)).toBeUndefined()
  })
})
