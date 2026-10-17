import { describe, it, expect } from 'vitest'
import { HEADER_BACK_FALLBACK, headerBackLink } from './header-back-link'

const snapshot = (label: string, href: string, slugs: string[]) =>
  JSON.stringify({ label, href, items: slugs.map((slug) => ({ slug, title: slug })) })

describe('headerBackLink', () => {
  it('returns to the source list the recipe was opened from', () => {
    expect(headerBackLink('fav', snapshot('Ulubione', '/ulubione', ['a', 'b']), 'b')).toEqual({
      href: '/ulubione',
      text: 'Wróć',
      ariaLabel: 'Wróć do listy: Ulubione',
    })
  })

  it('says "Wyniki" when coming from search, keeping the visible text first in the name', () => {
    const link = headerBackLink('szukaj', snapshot('Wyniki wyszukiwania', '/szukaj?q=dynia', ['a']), 'a')
    expect(link.href).toBe('/szukaj?q=dynia')
    expect(link.text).toBe('Wyniki')
    expect(link.ariaLabel.startsWith(link.text)).toBe(true)
  })

  it('falls back to the start page without ?from, without a snapshot, or when the recipe is not in it', () => {
    expect(headerBackLink(null, snapshot('Ulubione', '/ulubione', ['a']), 'a')).toBe(HEADER_BACK_FALLBACK)
    expect(headerBackLink('fav', null, 'a')).toBe(HEADER_BACK_FALLBACK)
    expect(headerBackLink('fav', snapshot('Ulubione', '/ulubione', ['x']), 'a')).toBe(HEADER_BACK_FALLBACK)
  })

  it('never links off-site from a tampered snapshot', () => {
    expect(headerBackLink('fav', snapshot('Zła', '//evil.example', ['a']), 'a')).toBe(HEADER_BACK_FALLBACK)
  })
})
