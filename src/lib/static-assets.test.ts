import { describe, it, expect } from 'vitest'
import { staticAssetPaths } from '@/lib/static-assets'

describe('staticAssetPaths', () => {
  it('reads CSS, JS and font paths from attributes and the inlined RSC payload', () => {
    const html = [
      '<link rel="stylesheet" href="/_next/static/chunks/1u7m6mc4o9h4e.css" data-precedence="next"/>',
      '<link rel="preload" as="font" href="/_next/static/media/inter.p.woff2" crossorigin="">',
      '<script src="/_next/static/chunks/07z3funczf3mi.js" async=""></script>',
      '<script>self.__next_f.push([1,"2:I[\\"/_next/static/chunks/06n1-8_oqhh4c.js\\"]"])</script>',
    ].join('\n')

    expect(staticAssetPaths(html)).toEqual([
      '/_next/static/chunks/06n1-8_oqhh4c.js',
      '/_next/static/chunks/07z3funczf3mi.js',
      '/_next/static/chunks/1u7m6mc4o9h4e.css',
      '/_next/static/media/inter.p.woff2',
    ])
  })

  it('lists a path once and drops its query string', () => {
    const html =
      '<script src="/_next/static/chunks/a.js?dpl=1"></script><link rel="preload" href="/_next/static/chunks/a.js">'

    expect(staticAssetPaths(html)).toEqual(['/_next/static/chunks/a.js'])
  })

  it('finds nothing in a page without build files', () => {
    expect(staticAssetPaths('<html><body>Coś poszło nie tak</body></html>')).toEqual([])
  })
})
