import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { NOTIFICATIONS_PATH, ADD_RECIPE_PATH } from '@/lib/routes'

// /robots.txt is a static file in public/, served by Workers Static Assets without
// running the Worker. As a Next route (src/app/robots.ts) every crawler fetch woke a
// cold Worker: a median 257 ms of CPU on the free plan's 10 ms budget (2026-10-22).
// The disallow list is the complement of isPublicRoute (src/lib/routes.ts): everything
// a guest can't open anyway, plus /szukaj's query permutations (#363 Phase 1).
const robots = readFileSync(join(process.cwd(), 'public', 'robots.txt'), 'utf8')
const lines = robots.split('\n').map((l) => l.trim())
const disallow = lines.filter((l) => l.startsWith('Disallow:')).map((l) => l.slice('Disallow:'.length).trim())

describe('robots.txt', () => {
  it('points crawlers at the sitemap and sets the host', () => {
    expect(lines).toContain('Sitemap: https://zapiszprzepis.pl/sitemap.xml')
    expect(lines).toContain('Host: https://zapiszprzepis.pl')
  })

  it('allows the public root and disallows the authenticated app, api and search permutations', () => {
    expect(lines).toContain('Allow: /')
    for (const path of ['/api/', '/recipes', '/ulubione', NOTIFICATIONS_PATH, '/settings', ADD_RECIPE_PATH, '/witaj', '/auth/', '/szukaj?']) {
      expect(disallow).toContain(path)
    }
  })

  it('does not disallow the public content paths', () => {
    expect(disallow).not.toContain('/')
    expect(disallow).not.toContain('/przepis')
    expect(disallow).not.toContain('/przepisy')
  })
})
