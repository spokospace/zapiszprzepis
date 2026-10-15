import { describe, it, expect } from 'vitest'
import { sourceLabel } from '@/lib/recipe-source'

describe('sourceLabel', () => {
  it('names the platform for Facebook and YouTube', () => {
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/groups/1/posts/2/')).toBe('Facebook')
    expect(sourceLabel('facebook_reel', null)).toBe('Facebook')
    expect(sourceLabel('youtube', 'https://youtu.be/abc')).toBe('YouTube')
  })

  it("names a blog by its domain, without www", () => {
    expect(sourceLabel('web_blog', 'https://www.polskiekulinaria.pl/tiramisu')).toBe('polskiekulinaria.pl')
  })

  it('falls back to a generic label without a usable URL', () => {
    expect(sourceLabel('web_blog', null)).toBe('Blog')
    expect(sourceLabel('other', 'not a url')).toBe('Inny')
  })
})
