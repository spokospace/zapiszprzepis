import { describe, it, expect } from 'vitest'
import { sourceLabel } from '@/lib/recipe-source'

describe('sourceLabel', () => {
  it('names the platform for Facebook and YouTube', () => {
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/groups/1/posts/2/')).toBe('Facebook')
    expect(sourceLabel('facebook_reel', null)).toBe('Facebook')
    expect(sourceLabel('youtube', 'https://youtu.be/abc')).toBe('YouTube')
  })

  it('names a known Facebook author before the platform, whatever the link shape', () => {
    const wiola = 'Kulinarna Wiola · Facebook'
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/100069645633702/posts/pfbid0289YMoX2fdF/')).toBe(wiola)
    expect(sourceLabel('facebook_reel', 'https://www.facebook.com/100069645633702/videos/sernik/1784278505620096/')).toBe(wiola)
    expect(
      sourceLabel('facebook_text', 'https://www.facebook.com/permalink.php?story_fbid=pfbid0289YMoX2fdF&id=100069645633702'),
    ).toBe(wiola)
  })

  it('keeps the bare platform for unknown profiles, groups and reels', () => {
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/123456/posts/789/')).toBe('Facebook')
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/groups/100069645633702/posts/2/')).toBe('Facebook')
    expect(sourceLabel('facebook_reel', 'https://www.facebook.com/reel/100069645633702')).toBe('Facebook')
    expect(sourceLabel('web_blog', 'https://example.com/100069645633702/')).toBe('example.com')
  })

  it("names a blog by its domain, without www", () => {
    expect(sourceLabel('web_blog', 'https://www.polskiekulinaria.pl/tiramisu')).toBe('polskiekulinaria.pl')
  })

  it('falls back to a generic label without a usable URL', () => {
    expect(sourceLabel('web_blog', null)).toBe('Blog')
    expect(sourceLabel('other', 'not a url')).toBe('Inny')
  })
})
