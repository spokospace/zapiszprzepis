import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './url-normalize'

describe('normalizeUrl', () => {
  it('lowercases the host, drops the fragment and a trailing slash, keeps the query', () => {
    expect(normalizeUrl('https://Example.COM/przepis/?id=3#comments')).toBe('https://example.com/przepis?id=3')
  })

  it('keys a feed-opened group post by its permalink, whatever the tracking token', () => {
    const fromFeed = (cft: string) =>
      `https://www.facebook.com/groups/7359364344169972?multi_permalinks=28043864251960012&hoisted_section_header_type=recently_seen&__cft__[0]=${cft}&__tn__=%2CO%2CP-R`
    const key = 'https://www.facebook.com/groups/7359364344169972/posts/28043864251960012'

    expect(normalizeUrl(fromFeed('AZjy8S3d'))).toBe(key)
    expect(normalizeUrl(fromFeed('AZiPxJ_i'))).toBe(key)
    expect(normalizeUrl('https://m.facebook.com/groups/7359364344169972/permalink/28043864251960012/')).toBe(key)
  })

  it('keys a Page post by its /posts/ form', () => {
    expect(
      normalizeUrl('https://www.facebook.com/permalink.php?story_fbid=pfbid0Fmx&id=100069645633702&__cft__[0]=AZjw'),
    ).toBe('https://www.facebook.com/100069645633702/posts/pfbid0Fmx')
  })

  it('drops Facebook tracking but keeps the params that name the post', () => {
    expect(normalizeUrl('https://facebook.com/watch/?v=123&rdid=abc&mibextid=xyz')).toBe(
      'https://www.facebook.com/watch?v=123',
    )
    expect(normalizeUrl('https://www.facebook.com/reel/987/?s=fb_shorts&mibextid=q')).toBe(
      'https://www.facebook.com/reel/987',
    )
  })

  it('leaves share shortlinks on their own host', () => {
    expect(normalizeUrl('https://fb.watch/abc/?mibextid=q')).toBe('https://fb.watch/abc')
  })
})
