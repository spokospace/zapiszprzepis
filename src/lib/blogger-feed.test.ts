import { describe, it, expect } from 'vitest'
import { isBlogspotUrl, mayBeBloggerPost, isCutAtJumpBreak, extractPostBody } from '@/lib/blogger-feed'

// A blog whose feed stops at the jump break serves only the teaser (seen on
// obzarciuch.pl); the recipe has to come from the post page.
describe('isCutAtJumpBreak', () => {
  it('detects a feed entry that ends in the "Read more" link', () => {
    const teaser =
      '<div><b>Rewelacyjna zupa</b></div>\n<a href="https://www.obzarciuch.pl/2013/10/barszcz-ukrainski.html#more">Read more »</a>'
    expect(isCutAtJumpBreak(teaser)).toBe(true)
  })

  it('leaves a full entry alone, even one linking to another post\'s #more', () => {
    expect(isCutAtJumpBreak('<p>Składniki: mąka</p><p>Przygotowanie: wymieszaj.</p>')).toBe(false)
    expect(isCutAtJumpBreak('<p>Zobacz <a href="https://x.pl/a.html#more">też</a> ten przepis. Składniki: …</p>')).toBe(false)
  })
})

describe('extractPostBody', () => {
  it('returns the whole post body, nested divs included, without scripts and styles', () => {
    const page =
      "<div class='sidebar'>Popularne</div>" +
      "<div class='post-body entry-content' id='post-body-2227990610720500505'>" +
      '<div>Rewelacyjna zupa</div>Składniki:<ul><li>5 buraków</li></ul>' +
      '<div><script>(adsbygoogle = window.adsbygoogle || []).push({});</script></div>' +
      '<style>.star { color: #ccc; }</style>Przygotowanie: gotujemy.' +
      '</div><div class="comments">Komentarz</div>'
    const body = extractPostBody(page)
    expect(body).toContain('5 buraków')
    expect(body).toContain('Przygotowanie: gotujemy.')
    expect(body).not.toContain('adsbygoogle')
    expect(body).not.toContain('.star')
    expect(body).not.toContain('Komentarz')
  })

  it('returns null for a page with no post body', () => {
    expect(extractPostBody('<html><body>Not Blogger</body></html>')).toBeNull()
  })
})

// Risk 5 — blogspot must be detected so it takes the deterministic Blogger-feed
// path instead of the Firecrawl path (which returns Google-Translate junk).
// Only the URL predicates are pure; fetchBloggerPost is IO and out of scope here.

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

describe('mayBeBloggerPost', () => {
  it('accepts any blogspot URL', () => {
    expect(mayBeBloggerPost('https://foo.blogspot.com/p/about.html')).toBe(true)
  })

  it('FIX: accepts Blogger-shaped post paths on custom domains', () => {
    expect(
      mayBeBloggerPost('https://www.lekcjewkuchni.pl/2019/02/kruche-rozki-kokosowe-coconut-horn.html?fbclid=abc'),
    ).toBe(true)
  })

  it('rejects other paths on custom domains', () => {
    expect(mayBeBloggerPost('https://www.kwestiasmaku.com/przepis/sernik')).toBe(false)
    expect(mayBeBloggerPost('https://example.com/2019/02/15/slug/')).toBe(false)
    expect(mayBeBloggerPost('not a url')).toBe(false)
  })
})
