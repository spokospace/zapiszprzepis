import { describe, expect, it } from 'vitest'
import { httpsRedirect } from './https-redirect'

const SITE_URL = 'https://zapiszprzepis.pl'

describe('httpsRedirect (#645)', () => {
  it('sends a plain-HTTP page request on the site host to HTTPS with a 301', () => {
    const res = httpsRedirect(new Request('http://zapiszprzepis.pl/'), SITE_URL)
    expect(res?.status).toBe(301)
    expect(res?.headers.get('location')).toBe('https://zapiszprzepis.pl/')
  })

  it('keeps the path and the query', () => {
    const res = httpsRedirect(new Request('http://zapiszprzepis.pl/przepisy/obiady?add_fav=758'), SITE_URL)
    expect(res?.headers.get('location')).toBe('https://zapiszprzepis.pl/przepisy/obiady?add_fav=758')
  })

  it('drops an explicit :80 port', () => {
    const res = httpsRedirect(new Request('http://zapiszprzepis.pl:80/przepis/x'), SITE_URL)
    expect(res?.headers.get('location')).toBe('https://zapiszprzepis.pl/przepis/x')
  })

  it('answers HEAD with a 301 and a POST with a 308, so the method is kept', () => {
    expect(httpsRedirect(new Request('http://zapiszprzepis.pl/', { method: 'HEAD' }), SITE_URL)?.status).toBe(301)
    expect(httpsRedirect(new Request('http://zapiszprzepis.pl/login', { method: 'POST' }), SITE_URL)?.status).toBe(308)
  })

  it('leaves an HTTPS request alone', () => {
    expect(httpsRedirect(new Request('https://zapiszprzepis.pl/'), SITE_URL)).toBeNull()
  })

  it('leaves other hosts alone: local wrangler dev, workers.dev previews', () => {
    expect(httpsRedirect(new Request('http://localhost:8787/'), SITE_URL)).toBeNull()
    expect(httpsRedirect(new Request('http://abc-zapiszprzepis.spoko.workers.dev/'), SITE_URL)).toBeNull()
  })

  it('does nothing without an https site URL', () => {
    expect(httpsRedirect(new Request('http://zapiszprzepis.pl/'), undefined)).toBeNull()
    expect(httpsRedirect(new Request('http://zapiszprzepis.pl/'), '')).toBeNull()
    expect(httpsRedirect(new Request('http://zapiszprzepis.pl/'), 'not a url')).toBeNull()
    expect(httpsRedirect(new Request('http://localhost:3000/'), 'http://localhost:3000')).toBeNull()
  })
})
