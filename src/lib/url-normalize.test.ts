import { describe, expect, it } from 'vitest'
import { normalizeUrl, resolvedSourceUrl, sourceUrlPattern } from './url-normalize'

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

describe('resolvedSourceUrl', () => {
  const SHARE = 'https://www.facebook.com/share/p/1AbCdEf/'

  it('keys a share link by the post it redirected to', () => {
    expect(resolvedSourceUrl(SHARE, 'https://www.facebook.com/groups/obiadek/permalink/2685730571747766/')).toBe(
      'https://www.facebook.com/groups/obiadek/posts/2685730571747766',
    )
    expect(resolvedSourceUrl(SHARE, 'https://www.facebook.com/permalink.php?story_fbid=pfbid0Fmx&id=100069645633702')).toBe(
      'https://www.facebook.com/100069645633702/posts/pfbid0Fmx',
    )
  })

  it('keeps the share link when the redirect did not land on a post', () => {
    expect(resolvedSourceUrl(SHARE, 'https://www.facebook.com/login/?next=x')).toBe(SHARE)
    expect(resolvedSourceUrl(SHARE, SHARE)).toBe(SHARE)
    expect(resolvedSourceUrl(SHARE, undefined)).toBe(SHARE)
  })

  it('leaves links that are not share links alone', () => {
    const post = 'https://www.facebook.com/reel/987'
    expect(resolvedSourceUrl(post, 'https://www.facebook.com/reel/123')).toBe(post)
  })
})

describe('sourceUrlPattern', () => {
  it('matches a group post under any group name or number', () => {
    expect(sourceUrlPattern('https://www.facebook.com/groups/obiadek/posts/2685730571747766')).toBe(
      'https://www.facebook.com/groups/%/posts/2685730571747766',
    )
  })

  it('is null for keys that only match themselves', () => {
    expect(sourceUrlPattern('https://www.facebook.com/reel/987')).toBeNull()
    expect(sourceUrlPattern('https://example.com/groups/a/posts/1')).toBeNull()
  })
})
