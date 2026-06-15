import { describe, it, expect } from 'vitest'
import { buildFirecrawlOptions, buildEmbedScanOptions } from '@/lib/firecrawl'

// Reference unit test for the project (see test-plan §6.1): pure config builder,
// one assertion group per branch, no IO. The IO (fetch/auth/timeout) lives in the
// pipeline caller and is out of scope for unit tests.

const URL = 'https://example.com/recipe'

describe('buildFirecrawlOptions', () => {
  it('web_blog (default) requests main content with a wait action, no excludeTags', () => {
    const opts = buildFirecrawlOptions(URL, 'web_blog')
    expect(opts.url).toBe(URL)
    expect(opts.formats).toEqual(['markdown', 'html'])
    expect(opts.onlyMainContent).toBe(true)
    expect(opts.actions).toEqual([{ type: 'wait', milliseconds: 2000 }])
    expect(opts.excludeTags).toBeUndefined()
  })

  it('web_blog + fullContent drops main-content filtering and adds excludeTags (incl. iframe)', () => {
    const opts = buildFirecrawlOptions(URL, 'web_blog', { fullContent: true })
    expect(opts.onlyMainContent).toBe(false)
    expect(opts.actions).toEqual([{ type: 'wait', milliseconds: 2000 }])
    expect(opts.excludeTags).toContain('iframe')
  })

  it('youtube waits but never excludes tags (keep the description)', () => {
    const base = buildFirecrawlOptions(URL, 'youtube')
    expect(base.actions).toEqual([{ type: 'wait', milliseconds: 2000 }])
    expect(base.excludeTags).toBeUndefined()
    expect(base.onlyMainContent).toBe(true)

    const full = buildFirecrawlOptions(URL, 'youtube', { fullContent: true })
    expect(full.onlyMainContent).toBe(false)
    expect(full.excludeTags).toBeUndefined()
  })

  it('facebook_text returns the bare base (no actions, no excludeTags)', () => {
    const opts = buildFirecrawlOptions(URL, 'facebook_text')
    expect(opts.formats).toEqual(['markdown', 'html'])
    expect(opts.onlyMainContent).toBe(true)
    expect(opts.actions).toBeUndefined()
    expect(opts.excludeTags).toBeUndefined()
  })
})

describe('buildEmbedScanOptions', () => {
  it('requests the full page as HTML only, preserving iframes', () => {
    const opts = buildEmbedScanOptions(URL)
    expect(opts.url).toBe(URL)
    expect(opts.formats).toEqual(['html'])
    expect(opts.onlyMainContent).toBe(false)
    expect(opts.actions).toEqual([{ type: 'wait', milliseconds: 2000 }])
    expect(opts.excludeTags).toBeUndefined()
  })
})
