import { describe, it, expect } from 'vitest'
import { isBlogspotUrl } from '@/lib/blogger-feed'

// Risk 5 — blogspot must be detected so it takes the deterministic Blogger-feed
// path instead of the Firecrawl path (which returns Google-Translate junk).
// Only isBlogspotUrl is pure; fetchBloggerPost is IO and out of scope here.

describe('isBlogspotUrl', () => {
  it('detects .com blogspot hosts (incl. subdomains)', () => {
    expect(isBlogspotUrl('https://foo.blogspot.com/2020/01/x.html')).toBe(true)
    expect(isBlogspotUrl('https://www.foo.blogspot.com/2020/01/x.html')).toBe(true)
    expect(isBlogspotUrl('https://sub.foo.blogspot.com/p.html')).toBe(true)
  })

  it('FIX: detects country-coded blogspot TLDs', () => {
    expect(isBlogspotUrl('https://foo.blogspot.de/2020/01/x.html')).toBe(true)
    expect(isBlogspotUrl('https://foo.blogspot.co.uk/2020/01/x.html')).toBe(true)
    expect(isBlogspotUrl('https://foo.blogspot.com.au/p.html')).toBe(true)
  })

  it('rejects deceptive and non-blogspot hosts', () => {
    expect(isBlogspotUrl('https://foo.blogspot.com.evil.com/p.html')).toBe(false)
    expect(isBlogspotUrl('https://www.mecooks.com/przepis')).toBe(false)
    expect(isBlogspotUrl('not a url')).toBe(false)
  })
})
