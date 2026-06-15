import { describe, it, expect } from 'vitest'
import {
  normalizeHost,
  isYoutubeHost,
  youtubeIdFromUrl,
  findEmbeddedYoutubeId,
} from '@/lib/youtube'

// Risk 5 — YouTube host detection and id extraction (S-04 stores youtube_id).
const ID = 'dQw4w9WgXcQ' // canonical 11-char id

describe('normalizeHost', () => {
  it('strips www. / m. / music. prefixes (one each, in order)', () => {
    expect(normalizeHost('www.youtube.com')).toBe('youtube.com')
    expect(normalizeHost('m.youtube.com')).toBe('youtube.com')
    expect(normalizeHost('music.youtube.com')).toBe('youtube.com')
    expect(normalizeHost('www.m.youtube.com')).toBe('youtube.com')
  })

  it('leaves other subdomains untouched', () => {
    expect(normalizeHost('gaming.youtube.com')).toBe('gaming.youtube.com')
  })
})

describe('isYoutubeHost', () => {
  it('accepts the canonical hosts and their www./m./music. forms', () => {
    expect(isYoutubeHost('youtube.com')).toBe(true)
    expect(isYoutubeHost('youtu.be')).toBe(true)
    expect(isYoutubeHost('youtube-nocookie.com')).toBe(true)
    expect(isYoutubeHost('m.youtube.com')).toBe(true)
  })

  it('FIX: accepts arbitrary subdomains of a YouTube host', () => {
    expect(isYoutubeHost('gaming.youtube.com')).toBe(true)
    expect(isYoutubeHost('studio.youtube.com')).toBe(true)
  })

  it('rejects non-YouTube and look-alike hosts', () => {
    expect(isYoutubeHost('vimeo.com')).toBe(false)
    expect(isYoutubeHost('notyoutube.com')).toBe(false)
    expect(isYoutubeHost('youtube.com.evil.com')).toBe(false)
  })
})

describe('youtubeIdFromUrl', () => {
  it('extracts the id from every supported direct-URL shape', () => {
    expect(youtubeIdFromUrl(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://youtu.be/${ID}?si=abc`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/live/${ID}`)).toBe(ID)
    expect(youtubeIdFromUrl(`https://m.youtube.com/watch?v=${ID}&t=30s`)).toBe(ID)
  })

  it('FIX: extracts the id from a non-www subdomain', () => {
    expect(youtubeIdFromUrl(`https://gaming.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('returns null for unsupported shapes and non-YouTube hosts', () => {
    expect(youtubeIdFromUrl(`https://www.youtube.com/v/${ID}`)).toBeNull() // /v/ not handled here
    expect(youtubeIdFromUrl('https://www.youtube.com/playlist?list=PLabc')).toBeNull()
    expect(youtubeIdFromUrl('https://www.youtube.com/watch?v=tooShort')).toBeNull()
    expect(youtubeIdFromUrl('https://vimeo.com/123456')).toBeNull()
    expect(youtubeIdFromUrl('not a url')).toBeNull()
  })
})

describe('findEmbeddedYoutubeId', () => {
  it('finds the first embed id in arbitrary HTML', () => {
    expect(findEmbeddedYoutubeId(`<iframe src="https://www.youtube.com/embed/${ID}"></iframe>`)).toBe(ID)
    expect(findEmbeddedYoutubeId(`<iframe src="https://www.youtube-nocookie.com/embed/${ID}"></iframe>`)).toBe(ID)
    expect(findEmbeddedYoutubeId(`<a href="https://youtu.be/${ID}">link</a>`)).toBe(ID)
    expect(findEmbeddedYoutubeId(`watch here: https://www.youtube.com/watch?v=${ID} thanks`)).toBe(ID)
  })

  it('returns null for empty HTML and pages with no embed', () => {
    expect(findEmbeddedYoutubeId('')).toBeNull()
    expect(findEmbeddedYoutubeId('<p>no video here</p>')).toBeNull()
  })

  it('ASYMMETRY: /v/<id> is found here but not by youtubeIdFromUrl', () => {
    const vForm = `<iframe src="https://www.youtube.com/v/${ID}"></iframe>`
    expect(findEmbeddedYoutubeId(vForm)).toBe(ID)
    expect(youtubeIdFromUrl(`https://www.youtube.com/v/${ID}`)).toBeNull()
  })
})
