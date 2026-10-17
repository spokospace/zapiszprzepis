import { describe, it, expect } from 'vitest'
import { extractFirstUrl } from './extract-url'

describe('extractFirstUrl', () => {
  it('returns a bare URL as is', () => {
    expect(extractFirstUrl('https://aniagotuje.pl/przepis/sernik')).toBe('https://aniagotuje.pl/przepis/sernik')
  })

  it('picks the link out of shared text and drops trailing punctuation', () => {
    expect(extractFirstUrl('Zobacz to: https://example.com/tiramisu).')).toBe('https://example.com/tiramisu')
  })

  it('falls through the candidates in order, skipping empty ones', () => {
    expect(extractFirstUrl(null, undefined, 'bez linku', 'tu http://a.pl/x jest')).toBe('http://a.pl/x')
  })

  it('returns null when no candidate holds an http(s) URL', () => {
    expect(extractFirstUrl('ftp://a.pl', 'pierogi z mięsem', null)).toBeNull()
  })
})
