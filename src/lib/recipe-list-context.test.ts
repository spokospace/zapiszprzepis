import { describe, it, expect } from 'vitest'
import { listStorageKey, locate, parseListKey, parseSnapshot, type ListSnapshot } from '@/lib/recipe-list-context'

const snapshot: ListSnapshot = {
  label: 'Ulubione',
  href: '/ulubione',
  items: [
    { slug: 'sernik', title: 'Sernik' },
    { slug: 'murzynek', title: 'Murzynek' },
    { slug: 'szarlotka', title: 'Szarlotka' },
  ],
}

describe('parseListKey', () => {
  it('accepts only whitelisted keys', () => {
    expect(parseListKey('fav')).toBe('fav')
    expect(parseListKey('moje')).toBe('moje')
    expect(parseListKey('home')).toBe('home')
    expect(parseListKey('evil')).toBeNull()
    expect(parseListKey('fav ')).toBeNull()
    expect(parseListKey(['fav'])).toBeNull()
    expect(parseListKey(undefined)).toBeNull()
  })

  it('builds the storage key from a valid key', () => {
    expect(listStorageKey('fav')).toBe('zp-list:fav')
  })
})

describe('parseSnapshot', () => {
  it('round-trips a valid snapshot', () => {
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('rejects malformed input (never throws)', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('{')).toBeNull()
    expect(parseSnapshot('[]')).toBeNull()
    expect(parseSnapshot(JSON.stringify({ ...snapshot, items: [{ slug: 1 }] }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ ...snapshot, label: 3 }))).toBeNull()
  })

  it('rejects a back link that leaves the site', () => {
    expect(parseSnapshot(JSON.stringify({ ...snapshot, href: 'https://evil.example' }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ ...snapshot, href: '//evil.example' }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ ...snapshot, href: 'javascript:alert(1)' }))).toBeNull()
  })
})

describe('locate', () => {
  it('finds a middle item with both neighbours', () => {
    expect(locate(snapshot, 'murzynek')).toEqual({
      label: 'Ulubione',
      href: '/ulubione',
      index: 2,
      total: 3,
      prev: { slug: 'sernik', title: 'Sernik' },
      next: { slug: 'szarlotka', title: 'Szarlotka' },
    })
  })

  it('has no previous on the first item and no next on the last', () => {
    expect(locate(snapshot, 'sernik')).toMatchObject({ index: 1, prev: null, next: { slug: 'murzynek' } })
    expect(locate(snapshot, 'szarlotka')).toMatchObject({ index: 3, prev: { slug: 'murzynek' }, next: null })
  })

  it('returns null (fall back) when the recipe is not in the list or there is no snapshot', () => {
    expect(locate(snapshot, 'pierogi')).toBeNull()
    expect(locate(null, 'sernik')).toBeNull()
  })
})
