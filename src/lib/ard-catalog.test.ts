import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/site-url', () => ({ getSiteUrl: vi.fn(async () => 'https://zapiszprzepis.pl') }))

import { ARD_IDENTIFIER_PATTERN, buildArdCatalog } from './ard-catalog'
import { GET as getAiCatalog } from '@/app/.well-known/ai-catalog.json/route'
import { GET as getArd } from '@/app/.well-known/ard.json/route'

describe('buildArdCatalog — the constraints Lighthouse 13.5 ard-schema checks (#546)', () => {
  const manifest = buildArdCatalog('https://zapiszprzepis.pl')

  it('carries the root specVersion "1.0" and at least one entry', () => {
    expect(manifest.specVersion).toBe('1.0')
    expect(manifest.entries.length).toBeGreaterThan(0)
  })

  it.each(manifest.entries.map((e) => [e.identifier, e]))('%s is a valid entry', (_, entry) => {
    expect(entry.identifier).toMatch(ARD_IDENTIFIER_PATTERN)
    expect(entry.displayName).toBeTruthy()
    expect(entry.type).toBeTruthy()
    // Exactly one of url / data.
    expect(entry.url).toBeTruthy()
    expect('data' in entry).toBe(false)
    expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2)
    expect(entry.representativeQueries.length).toBeLessThanOrEqual(5)
    expect(entry.trustManifest).toEqual({ identity: 'https://zapiszprzepis.pl', identityType: 'https' })
    // The URN's domain segment names the same host as the trust identity.
    expect(entry.identifier.split(':')[2]).toBe(new URL(entry.trustManifest.identity).hostname)
    expect(new URL(entry.url).origin).toBe('https://zapiszprzepis.pl')
  })

  it('lists only the llms.txt the site really serves', () => {
    expect(manifest.entries.map((e) => e.url)).toEqual(['https://zapiszprzepis.pl/llms.txt'])
  })
})

describe('GET /.well-known/ai-catalog.json and /.well-known/ard.json', () => {
  it('serve the same manifest as application/json', async () => {
    const [a, b] = await Promise.all([getAiCatalog(), getArd()])
    for (const res of [a, b]) {
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    }
    const body = await a.text()
    expect(await b.text()).toBe(body)
    expect(JSON.parse(body)).toEqual(buildArdCatalog('https://zapiszprzepis.pl'))
  })
})
