import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/site-url', () => ({ getSiteUrl: vi.fn(async () => 'https://zapiszprzepis.pl') }))

import robots from './robots'

describe('robots.txt', () => {
  it('points crawlers at the sitemap and sets the host', async () => {
    const r = await robots()
    expect(r.sitemap).toBe('https://zapiszprzepis.pl/sitemap.xml')
    expect(r.host).toBe('https://zapiszprzepis.pl')
  })

  it('allows the public root and disallows the authenticated app, api and search permutations', async () => {
    const r = await robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rule.allow).toBe('/')
    const disallow = rule.disallow as string[]
    for (const path of ['/api/', '/recipes', '/ulubione', '/powiadomienia', '/settings', '/dodaj', '/witaj', '/auth/', '/szukaj?']) {
      expect(disallow).toContain(path)
    }
  })

  it('does not disallow the public content paths', async () => {
    const r = await robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    const disallow = rule.disallow as string[]
    expect(disallow).not.toContain('/')
    expect(disallow).not.toContain('/przepis')
    expect(disallow).not.toContain('/przepisy')
  })
})
