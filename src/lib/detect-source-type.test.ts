import { describe, it, expect } from 'vitest'
import { detectSourceType } from '@/lib/detect-source-type'

// Risk 5 — wrong source-type detection routes a link into the wrong path.

describe('detectSourceType', () => {
  it('routes Facebook hosts to facebook_text', () => {
    expect(detectSourceType('https://facebook.com/some/post')).toBe('facebook_text')
    expect(detectSourceType('https://www.facebook.com/some/post')).toBe('facebook_text')
    expect(detectSourceType('https://fb.watch/abc123')).toBe('facebook_text')
    expect(detectSourceType('https://fb.me/abc')).toBe('facebook_text')
  })

  it('routes YouTube hosts (incl. subdomains and mobile) to youtube', () => {
    expect(detectSourceType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectSourceType('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(detectSourceType('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectSourceType('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectSourceType('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('youtube')
  })

  it('FIX: gaming.youtube.com (other subdomain) routes to youtube, not web_blog', () => {
    expect(detectSourceType('https://gaming.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectSourceType('https://studio.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
  })

  it('routes blogspot, generic blogs and malformed URLs to web_blog', () => {
    expect(detectSourceType('https://foo.blogspot.com/2020/01/x.html')).toBe('web_blog')
    expect(detectSourceType('https://foo.blogspot.de/2020/01/x.html')).toBe('web_blog')
    expect(detectSourceType('https://www.mecooks.com/przepis')).toBe('web_blog')
    expect(detectSourceType('not a url')).toBe('web_blog')
  })
})
